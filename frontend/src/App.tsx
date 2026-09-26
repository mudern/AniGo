import { lazy, Suspense, useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout, Spin } from 'antd'
import SideMenu from './components/SideMenu'
import LoginPage from './pages/LoginPage'
import { api } from './api/client'

const HomePage = lazy(() => import('./pages/HomePage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const RecordsPage = lazy(() => import('./pages/RecordsPage'))

const { Content } = Layout

function CenteredSpin() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spin size="large" />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AuthShell />
    </HashRouter>
  )
}

function AuthShell() {
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true
    api
      .checkLogin()
      .then((r) => {
        if (mounted) setAuthed(r.login)
      })
      .catch(() => {
        if (mounted) setAuthed(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const onUnauthorized = () => setAuthed(false)
    window.addEventListener('anigo:unauthorized', onUnauthorized)
    return () => window.removeEventListener('anigo:unauthorized', onUnauthorized)
  }, [])

  if (authed === null) {
    return <CenteredSpin />
  }

  if (!authed) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage onSuccess={() => setAuthed(true)} />} />
      </Routes>
    )
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <SideMenu />
      <Layout>
        <Content style={{ margin: 16, padding: 24, background: '#fff', borderRadius: 8 }}>
          <Suspense
            fallback={
              <div style={{ textAlign: 'center', padding: 48 }}>
                <Spin />
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/login" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/records" element={<RecordsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  )
}
