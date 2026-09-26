package service

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/greenhats/anigo/internal/domain"
)

// DownloadRecord 是一次下载任务提交的结果。
type DownloadRecord struct {
	Time     int64  `json:"time"`    // 毫秒时间戳
	AniID    string `json:"aniId"`   // 订阅 id
	Title    string `json:"title"`   // 番剧标题
	Name     string `json:"name"`    // 文件名（重命名后）
	Episode  string `json:"episode"` // 集数描述
	Subgroup string `json:"subgroup"`
	Status   string `json:"status"`  // success / error
	Message  string `json:"message"` // 失败原因（成功时空）
}

// downloadRecordStore 内存环形存储 + 落缓存。
type downloadRecordStore struct {
	mu      sync.RWMutex
	records []*DownloadRecord
	max     int
}

var recordStore = &downloadRecordStore{max: 500}

// AddRecord 追加一条记录，超出容量丢弃最旧的。
func AddRecord(r *DownloadRecord) {
	recordStore.mu.Lock()
	defer recordStore.mu.Unlock()
	recordStore.records = append(recordStore.records, r)
	if len(recordStore.records) > recordStore.max {
		recordStore.records = recordStore.records[len(recordStore.records)-recordStore.max:]
	}
}

// ListRecords 返回记录（最新在前）。
func ListRecords() []*DownloadRecord {
	recordStore.mu.RLock()
	defer recordStore.mu.RUnlock()
	out := make([]*DownloadRecord, len(recordStore.records))
	for i, r := range recordStore.records {
		out[i] = r
	}
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	return out
}

// LoadRecords 从缓存恢复。
func LoadRecords(c domain.Cache) {
	if raw, ok := c.Get("download:records"); ok {
		var rs []*DownloadRecord
		if json.Unmarshal([]byte(raw), &rs) == nil {
			recordStore.mu.Lock()
			recordStore.records = rs
			recordStore.mu.Unlock()
		}
	}
}

// PersistRecords 序列化记录到缓存。
func PersistRecords(c domain.Cache) {
	recordStore.mu.RLock()
	b, err := json.Marshal(recordStore.records)
	recordStore.mu.RUnlock()
	if err == nil {
		c.Put("download:records", string(b), 365*24*time.Hour)
	}
}

// epDesc 将集数数字转为展示字符串。
func epDesc(ep float64) string {
	if ep == 0 {
		return ""
	}
	if ep == float64(int(ep)) {
		return fmt.Sprintf("%d", int(ep))
	}
	return fmt.Sprintf("%g", ep)
}
