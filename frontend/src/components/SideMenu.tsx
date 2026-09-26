import { useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import {
  HomeOutlined,
  SettingOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'

const { Sider } = Layout

export default function SideMenu() {
  const nav = useNavigate()
  const loc = useLocation()
  const selected = '/' + (loc.pathname.split('/')[1] || 'home')

  return (
    <Sider width={200} className="anigo-sider" style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
      <div
        style={{
          color: '#1f1f1f',
          fontSize: 18,
          fontWeight: 600,
          textAlign: 'center',
          padding: '18px 0',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        AniGo
      </div>
      <Menu
        theme="light"
        mode="inline"
        selectedKeys={[selected]}
        style={{ background: '#fff', borderInlineEnd: 'none' }}
        items={[
          { key: '/home', icon: <HomeOutlined />, label: '订阅' },
          { key: '/records', icon: <UnorderedListOutlined />, label: '下载记录' },
          { key: '/settings', icon: <SettingOutlined />, label: '设置' },
        ]}
        onClick={({ key }) => nav(key)}
      />
    </Sider>
  )
}
