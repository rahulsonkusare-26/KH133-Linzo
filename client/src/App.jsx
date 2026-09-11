import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import ProtectedRoute from './components/ProtectedRoute.jsx'

const Login = lazy(() => import('./pages/Login.jsx'))
const Register = lazy(() => import('./pages/Register.jsx'))
const ComingSoon = lazy(() => import('./pages/ComingSoon.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const IntegratedRoom = lazy(() => import('./pages/IntegratedRoom.jsx'))
const MultiCallLobby = lazy(() => import('./pages/MultiCallLobby.jsx'))
const MultiCallRoom = lazy(() => import('./pages/MultiCallRoom.jsx'))
const SummaryCallLobby = lazy(() => import('./pages/SummaryCallLobby.jsx'))
const SummaryCallRoom = lazy(() => import('./pages/SummaryCallRoom.jsx'))
const CallHistory = lazy(() => import('./pages/CallHistory.jsx'))
const CallDetails = lazy(() => import('./pages/CallDetails.jsx'))
const SignLanguageDemo = lazy(() => import('./pages/SignLanguageDemo.jsx'))
const EgcmModuleDemo = lazy(() => import('./pages/EgcmModuleDemo.jsx'))
const Profile = lazy(() => import('./pages/Profile.jsx'))
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'))
const LinzoMeetPage = lazy(() => import('./pages/LinzoMeetPage.jsx'))

import Loader from './components/Loader.jsx';
import MainLayout from './components/MainLayout.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader size="large" /></div>}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<ComingSoon />} />
          {/* <Route path="/linzomeet" element={<LinzoMeetPage />} /> */}

          {/* Protected Routes Group */}
          <Route element={<ProtectedRoute />}>
            {/* Dashboard Layout Routes */}
            <Route element={<MainLayout />}>
              <Route path="/demo" element={<SignLanguageDemo />} />
              <Route path="/egcm" element={<EgcmModuleDemo />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/history" element={<CallHistory />} />
              <Route path="/settings" element={<Profile />} />
            </Route>

            {/* Room Routes */}
            <Route path="/integrated-room/:roomId" element={<IntegratedRoom />} />

            {/* MultiCall Routes */}
            <Route path="/multicall">
              <Route index element={<MultiCallLobby />} />
              <Route path="room/:roomId" element={<MultiCallRoom />} />
            </Route>

            {/* Summary Call Routes */}
            <Route path="/summary-call">
              <Route index element={<SummaryCallLobby />} />
              <Route path="room/:roomId" element={<SummaryCallRoom />} />
              <Route path=":roomId/details" element={<CallDetails />} />
              {/* Nested redirect for internal consistency */}
              <Route path="history" element={<Navigate to="/history" replace />} />
            </Route>
          </Route>

          {/* Redirects & Legacy Paths */}
          <Route path="/profile" element={<Navigate to="/settings" replace />} />
          <Route path="/room/:roomId" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <SpeedInsights />
    </BrowserRouter>
  )
}
