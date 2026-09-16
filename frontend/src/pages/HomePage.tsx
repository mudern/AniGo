import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Card,
  Tag,
  Button,
  Space,
  Tooltip,
  Typography,
  message,
  Popconfirm,
  Modal,
  Empty,
  Input,
  Form,
  List,
} from 'antd'
import {
  DeleteOutlined,
  SyncOutlined,
  PlusOutlined,
  CloudDownloadOutlined,
} from '@ant-design/icons'
import { api } from '../api/client'
import type { Ani, Item } from '../types'

const { Text } = Typography

export default function HomePage() {
  const { data, refetch, isFetching } = useQuery({ queryKey: ['listAni'], queryFn: api.listAni })
  const [refreshing, setRefreshing] = useState<string | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [previewAni, setPreviewAni] = useState<Ani | null>(null)
  const [previewItems, setPreviewItems] = useState<Item[] | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [addForm] = Form.useForm()

  // 扁平化所有订阅
  const allAnis = data?.weekList.flatMap(w => w.items) ?? []

  const handleDelete = async (id: string) => {
    await api.deleteAni([id])
    message.success('已删除')
    refetch()
  }

  const handleRefresh = async (id: string) => {
    setRefreshing(id)
    try {
      await api.refreshAni(id)
      message.success('已开始刷新并下载')
      refetch()
    } finally {
      setRefreshing(null)
    }
  }

  const handleToggle = async (ani: Ani) => {
    await api.batchEnable([ani.id], !ani.enable)
    refetch()
  }

  const handleRefreshAll = async () => {
    await api.refreshAll()
    message.success('已开始刷新全部')
    refetch()
  }

  const handleAdd = async (values: { url: string; title: string }) => {
    try {
      const newAni = await api.addAni({
        url: values.url,
        title: values.title || '新订阅',
        enable: true,
      })
      message.success('已添加订阅')
      setAddModalOpen(false)
      addForm.resetFields()
      refetch()
      // 添加后自动开始刷新下载
      if (newAni && typeof newAni === 'object' && 'id' in newAni) {
        await api.refreshAni((newAni as Ani).id)
      }
    } catch (e) {
      message.error(`添加失败: ${(e as Error).message}`)
    }
  }

  const handlePreview = async (ani: Ani) => {
    setPreviewAni(ani)
    setPreviewItems(null)
    setPreviewLoading(true)
    try {
      const r = await api.previewAni(ani)
      setPreviewItems(r.items)
    } catch (e) {
      message.error((e as Error).message)
      setPreviewAni(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          订阅 ({allAnis.length})
        </Typography.Title>
        <Space>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => setAddModalOpen(true)}>
            添加订阅
          </Button>
          <Button icon={<SyncOutlined />} onClick={handleRefreshAll} loading={isFetching}>
            刷新全部
          </Button>
        </Space>
      </div>

      {allAnis.length === 0 ? (
        <Empty description="暂无订阅，点击「添加订阅」开始" />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          {allAnis.map((ani) => (
            <Card key={ani.id} size="small" styles={{ body: { padding: 12 } }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {ani.image ? (
                  <img src={ani.image} alt="" style={{ width: 40, height: 56, objectFit: 'cover', borderRadius: 4 }} />
                ) : (
                  <div style={{ width: 40, height: 56, background: '#f0f0f0', borderRadius: 4 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div>
                    <Text strong>{ani.title}</Text>
                    {ani.season > 1 && <Tag style={{ marginLeft: 8 }}>第{ani.season}季</Tag>}
                    <Tag color={ani.enable ? 'green' : 'default'} style={{ marginLeft: 4 }}>
                      {ani.enable ? '启用' : '停用'}
                    </Tag>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    已下载 {ani.downloadedEps || ani.currentEpisodeNumber} / 共 {ani.totalEpisodeNumber || '?'} 集
                    {ani.subgroup && ` · ${ani.subgroup}`}
                  </Text>
                </div>
                <Space>
                  <Tooltip title="预览解析结果">
                    <Button size="small" icon={<CloudDownloadOutlined />} onClick={() => handlePreview(ani)} />
                  </Tooltip>
                  <Tooltip title="刷新并下载">
                    <Button size="small" icon={<SyncOutlined />} loading={refreshing === ani.id} onClick={() => handleRefresh(ani.id)} />
                  </Tooltip>
                  <Tooltip title={ani.enable ? '停用' : '启用'}>
                    <Button size="small" onClick={() => handleToggle(ani)}>
                      {ani.enable ? '停用' : '启用'}
                    </Button>
                  </Tooltip>
                  <Popconfirm title="删除该订阅？" onConfirm={() => handleDelete(ani.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              </div>
            </Card>
          ))}
        </Space>
      )}

      {/* 添加订阅弹窗 */}
      <Modal
        open={addModalOpen}
        onCancel={() => setAddModalOpen(false)}
        footer={null}
        title="添加订阅"
      >
        <Form form={addForm} layout="vertical" onFinish={handleAdd}>
          <Form.Item
            label="Mikan RSS 地址"
            name="url"
            rules={[{ required: true, message: '请输入 RSS 地址' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="https://mikanani.me/RSS/MyBangumi?token=xxx"
            />
          </Form.Item>
          <Form.Item label="订阅名称（可选）" name="title">
            <Input placeholder="留空则自动识别" />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            添加并开始下载
          </Button>
        </Form>
      </Modal>

      {/* 预览解析结果弹窗 */}
      <Modal
        open={!!previewAni}
        onCancel={() => setPreviewAni(null)}
        footer={null}
        width={700}
        title={
          <Space>
            <Text strong style={{ fontSize: 16 }}>
              {previewAni?.title ?? ''}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              解析到 {previewItems?.length ?? 0} 个条目
            </Text>
          </Space>
        }
      >
        {previewLoading ? (
          <div style={{ padding: 24, textAlign: 'center' }}>加载中...</div>
        ) : previewItems && previewItems.length > 0 ? (
          <List
            size="small"
            dataSource={previewItems.sort((a, b) => a.episode - b.episode)}
            renderItem={(item) => (
              <List.Item>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                  <Tag color="blue">EP {item.episode}</Tag>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 13 }} ellipsis>
                      {item.title}
                    </Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {item.subgroup} · {item.resolution} · {item.formatSize}
                    </Text>
                  </div>
                </div>
              </List.Item>
            )}
          />
        ) : (
          <Empty description="未解析到有效条目" />
        )}
      </Modal>
    </div>
  )
}
