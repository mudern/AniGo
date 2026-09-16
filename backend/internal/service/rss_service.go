package service

import (
	"fmt"
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
		episode := 0
		if len(parsed.EpisodeNumber) > 0 {
			ep, err := strconv.Atoi(parsed.EpisodeNumber[0])
			if err == nil && ep > 0 {
				episode = ep
			}
		}
		if episode <= 0 {
			// 无法解析集数，跳过
			continue
		}

		clone := it.Clone()
		clone.Title = parsed.AnimeTitle
		if clone.Title == "" {
			clone.Title = ani.Title
		}
		clone.Subgroup = parsed.ReleaseGroup
		if clone.Subgroup == "" {
			clone.Subgroup = subgroupName
		}
		clone.Resolution = parsed.VideoResolution
		if len(parsed.VideoTerm) > 0 {
			clone.VideoCodec = parsed.VideoTerm[0]
		}
		if len(parsed.Source) > 0 {
			clone.Source = parsed.Source[0]
		}
		if len(parsed.Subtitles) > 0 {
			clone.SubtitleLang = strings.Join(parsed.Subtitles, ",")
		}

		epFloat := float64(episode)
		if rename.RenameWithEpisode(ani, clone, cfg, epFloat) {
			refined = append(refined, clone)
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
