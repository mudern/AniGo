package httpapi

import (
	"github.com/gin-gonic/gin"

	"github.com/greenhats/anigo/internal/service"
)

// handleDownloadRecords 返回下载任务记录（最新在前）。
func (s *Server) handleDownloadRecords(c *gin.Context) {
	ok(c, gin.H{"records": service.ListRecords()})
}
