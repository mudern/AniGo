import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Form, Input, InputNumber, Button, message, Space, Select, Card, Upload, Switch } from 'antd'
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import { api } from '../api/client'
import type { Config } from '../types'

export default function SettingsPage() {
  const { data: cfg } = useQuery({ queryKey: ['config'], queryFn: api.getConfig })
  const queryClient = useQueryClient()
  const [form] = Form.useForm<Config>()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (cfg) form.setFieldsValue(cfg)
  }, [cfg, form])

  const handleSave = async () => {
    const values = form.getFieldsValue()
    setSaving(true)
    try {
      await api.setConfig(values)
      message.success('已保存')
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handle115Test = async () => {
    try {
      await api.downloadLoginTest(form.getFieldValue('pan115Cookie'))
      message.success('115 登录成功')
    } catch (e) {
      message.error(`115 登录失败: ${(e as Error).message}`)
    }
  }

  const handleExport = async () => {
    try {
      const resp = await api.exportConfig()
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'anigo.backup.zip'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      message.error(`导出失败: ${(e as Error).message}`)
    }
  }

  const handleImport = async (file: File) => {
    setSaving(true)
    try {
      const resp = await api.importConfig(file)
      const json = (await resp.json()) as { code: number; message: string }
      if (json.code !== 200) throw new Error(json.message)
      message.success('导入成功，配置已重新加载')
      await queryClient.invalidateQueries()
    } catch (e) {
      message.error(`导入失败: ${(e as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleSecuritySave = async (values: { username: string; password?: string }) => {
    setSaving(true)
    try {
      await api.setConfig({ login: { username: values.username, password: values.password ?? '' } })
      message.success('已保存')
    } catch (e) {
      message.error(`保存失败: ${(e as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <Form form={form} layout="vertical">
        {/* 115 设置 */}
        <Card title="115 网盘" size="small" style={{ marginBottom: 16 }}>
          <Form.Item label="115 Cookie" name="pan115Cookie">
            <Input.TextArea rows={3} placeholder="UID=...; CID=...; SEID=..." />
          </Form.Item>
          <Form.Item label="下载路径模板" name="downloadPathTemplate">
            <Input placeholder="${baseDownloadPath}/${title}/Season ${season}" />
          </Form.Item>
          <Form.Item label="基础下载路径" name="baseDownloadPath" extra="115 中的根目录，如「番剧」">
            <Input placeholder="番剧" />
          </Form.Item>
          <Form.Item label="重命名模板" name="renameTemplate">
            <Input placeholder="${title} S${seasonFormat}E${episodeFormat}" />
          </Form.Item>
          <Space>
            <Button onClick={handle115Test}>测试 115 登录</Button>
            <Button type="primary" onClick={handleSave} loading={saving}>
              保存
            </Button>
          </Space>
        </Card>

        {/* 代理设置 */}
        <Card title="代理设置" size="small" style={{ marginBottom: 16 }}>
          <Form.Item label="启用代理" name="proxy" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="代理地址" name="proxyHost" extra="HTTP 代理，如 http://127.0.0.1:7890">
            <Input placeholder="http://127.0.0.1:7890" />
          </Form.Item>
          <Form.Item label="代理用户名" name="proxyUsername">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item label="代理密码" name="proxyPassword">
            <Input.Password placeholder="可选" />
          </Form.Item>
          <Button type="primary" onClick={handleSave} loading={saving}>
            保存
          </Button>
        </Card>

        {/* RSS 设置 */}
        <Card title="RSS 设置" size="small" style={{ marginBottom: 16 }}>
          <Form.Item label="RSS 刷新间隔（分钟）" name="rssSleepMinutes">
            <InputNumber min={1} max={1440} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="排除规则" name="exclude">
            <Select mode="tags" placeholder="输入排除正则后回车" />
          </Form.Item>
          <Button type="primary" onClick={handleSave} loading={saving}>
            保存
          </Button>
        </Card>

        {/* 安全设置 */}
        <Card title="安全设置" size="small" style={{ marginBottom: 16 }}>
          <Form
            layout="vertical"
            onFinish={handleSecuritySave}
            initialValues={{ username: cfg?.login?.username }}
          >
            <Form.Item
              label="登录用户名"
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input placeholder="admin" />
            </Form.Item>
            <Form.Item label="新密码" name="password" extra="留空则不修改密码">
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Form.Item label="登录有效期（小时）" name="loginEffectiveHours">
              <InputNumber min={1} max={720} style={{ width: '100%' }} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>
              保存
            </Button>
          </Form>
        </Card>

        {/* 备份 */}
        <Card title="备份与恢复" size="small">
          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出备份
            </Button>
            <Upload
              showUploadList={false}
              beforeUpload={(file) => {
                handleImport(file as File)
                return false
              }}
            >
              <Button icon={<UploadOutlined />}>导入备份</Button>
            </Upload>
          </Space>
        </Card>
      </Form>
    </div>
  )
}
