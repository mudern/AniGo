package service

import (
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/greenhats/anigo/internal/domain"
	"github.com/greenhats/anigo/internal/log"
	"github.com/greenhats/anigo/internal/rename"
	"github.com/greenhats/anigo/internal/rss"
	"github.com/nssteinbrenner/anitogo"
)


// RssService 负责 RSS 聚合、解析与去重。
// 使用 anitogo 解析文件名提取集数，不需要 AI。
type RssService struct {
	cfg    *ConfigService
	logger *log.Logger
}

// NewRssService 创建 RSS 服务。
func NewRssService(cfg *ConfigService, logger *log.Logger) *RssService {
	return &RssService{
		cfg:    cfg,
		logger: logger,
	}
}

// GetItems 聚合 RSS 条目，按剧集排序。
// 每集只保留一个（最新的）。
func (s *RssService) GetItems(ani *domain.Ani) []*domain.Item {
	subgroup := ani.Subgroup
	if strings.TrimSpace(subgroup) == "" {
		subgroup = "未知字幕组"
	}
	items := s.getItems(ani, ani.URL, subgroup)

	// 按集去重，保留每集最后一条（最新的）
	items = rss.DistinctByEpisode(items)
	sort.SliceStable(items, func(i, j int) bool { return items[i].Episode < items[j].Episode })
	return items
}

// CurrentEpisodeNumber 计算当前集数。
func (s *RssService) CurrentEpisodeNumber(ani *domain.Ani, items []*domain.Item) int {
	seen := map[int]bool{}
	for _, it := range items {
		if it.Episode == float64(int(it.Episode)) {
			seen[int(it.Episode)] = true
		}
	}
	if len(seen) == 0 {
		return 0
	}
	if ani.DownloadNew {
		max := 0
		for ep := range seen {
			if ep > max {
				max = ep
			}
		}
		return max
	}
	return len(seen)
}

// getItems 解析单个 RSS 源为条目，用 anitogo 提取集数。
func (s *RssService) getItems(ani *domain.Ani, rssURL, subgroupName string) []*domain.Item {
	cfg := s.cfg.Get()
	s.logf("INFO", "rss", "%s rss开始刷新 (%s)", ani.Title, rssURL)
	xmlBody, err := rss.GetRSS(cfg, rssURL)
	if err != nil {
		s.logf("WARN", "rss", "%s rss获取失败: %v", ani.Title, err)
		return nil
	}
	items := rss.Parse(ani, rssURL, subgroupName, xmlBody)
	s.logf("INFO", "rss", "%s rss解析到 %d 个原始条目", ani.Title, len(items))

	if len(items) == 0 {
		return nil
	}

	// 用 anitogo 解析每个条目，提取集数
	var refined []*domain.Item
	for _, it := range items {
		parsed := anitogo.Parse(it.Title, anitogo.DefaultOptions)

		// anitogo 对多集合并（如 "01-13"）返回边界值 ["01","13"]，
		// expandEpisodeRange 将其展开为 [1,2,...,13]。
		episodeNumbers := parsed.EpisodeNumber
		if len(episodeNumbers) == 0 {
			// anitogo 无法解析时（如 "[01-13(全集)]" 带后缀的范围），
			// 用正则回退提取集数。
			episodeNumbers = fallbackEpisodeExtract(it.Title)
		}
		episodes := expandEpisodeRange(episodeNumbers)
		if len(episodes) == 0 {
			// 无法解析集数，跳过
			continue
		}

		// 基础字段（所有展开条目共用）
		baseTitle := parsed.AnimeTitle
		if baseTitle == "" {
			baseTitle = ani.Title
		}
		baseSubgroup := parsed.ReleaseGroup
		if baseSubgroup == "" {
			baseSubgroup = subgroupName
		}
		resolution := parsed.VideoResolution
		var videoCodec string
		if len(parsed.VideoTerm) > 0 {
			videoCodec = parsed.VideoTerm[0]
		}
		var source string
		if len(parsed.Source) > 0 {
			source = parsed.Source[0]
		}
		var subtitleLang string
		if len(parsed.Subtitles) > 0 {
			subtitleLang = strings.Join(parsed.Subtitles, ",")
		}

		// 多集合并：每条展开为多个单集条目，共享同一 torrent/infoHash，
		// 但在下载服务中靠 hash 去重只提交一次，同时每集都标记为已下载。
		for _, epFloat := range episodes {
			clone := it.Clone()
			clone.Title = baseTitle
			clone.Subgroup = baseSubgroup
			clone.Resolution = resolution
			clone.VideoCodec = videoCodec
			clone.Source = source
			clone.SubtitleLang = subtitleLang

			if rename.RenameWithEpisode(ani, clone, cfg, epFloat) {
				refined = append(refined, clone)
			}
		}
	}

	if len(refined) == 0 {
		s.logf("WARN", "rss", "%s anitogo解析后无有效条目", ani.Title)
		return nil
	}

	s.logf("INFO", "rss", "%s rss结束刷新, 共 %d 个条目", ani.Title, len(refined))
	return refined
}

// logf 写入 RSS 日志（logger 未注入时静默跳过）。
func (s *RssService) logf(level, logger, format string, args ...interface{}) {
	if s.logger == nil {
		return
	}
	s.logger.Log(level, logger, fmt.Sprintf(format, args...))
}

var (
	// regRangeEpisode 匹配 [01-13]、[01-13(全集)]、[01-02] 等范围式集数。
	regRangeEpisode = regexp.MustCompile(`\[(\d{1,4})[-~&+](\d{1,4})(?:[^\[\]]*)\]`)
	// regSingleEpisode 匹配 [05]、[13] 等单集集数（括号内只能是纯数字，避免误匹配标题中的数字如 [9-nine-]）。
	regSingleEpisode = regexp.MustCompile(`\[(\d{1,4})\]`)
)

// fallbackEpisodeExtract 是 anitogo 解析失败时的回退提取。
// 处理 anitogo 无法识别的范围写法（如带后缀 "(全集)" 的 "[01-13(全集)]"）。
func fallbackEpisodeExtract(title string) []string {
	// 优先匹配范围
	if m := regRangeEpisode.FindStringSubmatch(title); m != nil {
		return []string{m[1], m[2]}
	}
	// 回退到单集
	if m := regSingleEpisode.FindStringSubmatch(title); m != nil {
		return []string{m[1]}
	}
	return nil
}

// expandEpisodeRange 将 anitogo 的 EpisodeNumber 展开为单个集数列表。
// anitogo 对范围式标题（如 "01-13"、"#01-05"、"S01E01-E13"）返回两个边界值
// ["01","13"]，本函数将其展开为 [1,2,...,13]。
// 对单集标题（如 "05"）返回 ["05"] → [5]。
// 对无法解析的输入返回 nil。
func expandEpisodeRange(episodeNumbers []string) []float64 {
	if len(episodeNumbers) == 0 {
		return nil
	}

	// 单集：直接返回
	if len(episodeNumbers) == 1 {
		ep, err := strconv.Atoi(episodeNumbers[0])
		if err != nil || ep <= 0 {
			return nil
		}
		return []float64{float64(ep)}
	}

	// 多值：检查是否为范围（前两个值为下界和上界）
	start, err1 := strconv.Atoi(episodeNumbers[0])
	end, err2 := strconv.Atoi(episodeNumbers[1])
	if err1 == nil && err2 == nil && start > 0 && end > start {
		// 限制最大展开集数，防止异常数据（如 "01-9999"）导致内存问题
		const maxExpand = 200
		if end-start >= maxExpand {
			end = start + maxExpand - 1
		}
		out := make([]float64, 0, end-start+1)
		for ep := start; ep <= end; ep++ {
			out = append(out, float64(ep))
		}
		return out
	}

	// 非连续范围（如 alt number 场景）：收集所有有效集数
	seen := map[float64]bool{}
	var out []float64
	for _, s := range episodeNumbers {
		ep, err := strconv.Atoi(s)
		if err == nil && ep > 0 && !seen[float64(ep)] {
			seen[float64(ep)] = true
			out = append(out, float64(ep))
		}
	}
	if len(out) == 0 {
		return nil
	}
	sort.Float64s(out)
	return out
}
