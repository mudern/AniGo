import { useQuery } from '@tanstack/react-query'
import { Table, Tag, Typography, Empty, Tooltip } from 'antd'
import { api } from '../api/client'

interface DownloadRecord {
  time: number
  aniId: string
  title: string
  name: string
  episode: string
  subgroup: string
  status: 'success' | 'error'
  message: string
}

export default function RecordsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['downloadRecords'],
    queryFn: api.downloadRecords,
    refetchInterval: 15_000,
  })
  const records: DownloadRecord[] = data?.records ?? []

  const fmtTime = (ms: number) => {
    const d = new Date(ms)
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ padding: 4 }}>
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        下载记录
        <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400, marginLeft: 12 }}>
          提交的任务与结果（成功 {records.filter(r => r.status === 'success').length} · 失败 {records.filter(r => r.status === 'error').length}，15 秒自动刷新）
        </Typography.Text>
      </Typography.Title>
      {records.length === 0 && !isLoading ? (
        <Empty description="暂无记录，任务提交后显示在这里" style={{ marginTop: 60 }} />
      ) : (
        <Table<DownloadRecord>
          rowKey={(r) => `${r.time}-${r.name}`}
          size="small"
          loading={isLoading}
          dataSource={records}
          pagination={{ pageSize: 50, showSizeChanger: false }}
          columns={[
            {
              title: '时间',
              dataIndex: 'time',
              width: 110,
              render: (t: number) => <Typography.Text type="secondary" style={{ fontSize: 12 }}>{fmtTime(t)}</Typography.Text>,
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 70,
              filters: [
                { text: '成功', value: 'success' },
                { text: '失败', value: 'error' },
              ],
              onFilter: (v, r) => r.status === v,
              render: (s: string) =>
                s === 'success' ? <Tag color="success">成功</Tag> : <Tag color="error">失败</Tag>,
            },
            {
              title: '番剧',
              dataIndex: 'title',
              width: 180,
              ellipsis: true,
            },
            {
              title: '文件',
              dataIndex: 'name',
              ellipsis: true,
              render: (n: string, r) => (
                <Tooltip title={n}>
                  <span>{n}</span>
                  {r.episode && <Tag style={{ marginLeft: 8 }}>{r.episode}</Tag>}
                </Tooltip>
              ),
            },
            {
              title: '字幕组',
              dataIndex: 'subgroup',
              width: 120,
              ellipsis: true,
              render: (s: string) => s || '—',
            },
            {
              title: '原因',
              dataIndex: 'message',
              ellipsis: true,
              render: (m: string) =>
                m ? (
                  <Tooltip title={m}>
                    <Typography.Text type="danger" style={{ fontSize: 12 }}>{m}</Typography.Text>
                  </Tooltip>
                ) : (
                  '—'
                ),
            },
          ]}
        />
      )}
    </div>
  )
}
