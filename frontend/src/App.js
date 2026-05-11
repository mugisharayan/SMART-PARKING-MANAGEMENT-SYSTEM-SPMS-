import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';

import AttendantLayout from './pages/attendant/AttendantLayout';
import LiveMap from './pages/attendant/LiveMap';
import EntryForm from './pages/attendant/EntryForm';
import ExitForm from './pages/attendant/ExitForm';
import AttendantHistory from './pages/attendant/History';

import OperatorLayout from './pages/operator/OperatorLayout';
import Dashboard from './pages/operator/Dashboard';
import Destinations from './pages/operator/Destinations';
import SlotLayout from './pages/operator/SlotLayout';
import OperatorHistory from './pages/operator/History';
import BarrierLog from './pages/operator/BarrierLog';

function RootRedirect() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'OPERATOR' ? '/operator' : '/attendant'} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RootRedirect />} />

        {/* Attendant routes */}
        <Route element={<ProtectedRoute roles={['ATTENDANT']} />}>
          <Route path="/attendant" element={<AttendantLayout />}>
            <Route index element={<LiveMap />} />
            <Route path="entry" element={<EntryForm />} />
            <Route path="exit" element={<ExitForm />} />
            <Route path="history" element={<AttendantHistory />} />
          </Route>
        </Route>

        {/* Operator routes */}
        <Route element={<ProtectedRoute roles={['OPERATOR']} />}>
          <Route path="/operator" element={<OperatorLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="destinations" element={<Destinations />} />
            <Route path="slots" element={<SlotLayout />} />
            <Route path="history" element={<OperatorHistory />} />
            <Route path="barrier-log" element={<BarrierLog />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
