import { Dashboard } from '../pages/Dashboard';
import { BottomLayout } from '../components/layout/BottomLayout';

export default function DashboardRoute() {
    return (
        <BottomLayout>
            <Dashboard />
        </BottomLayout>
    );
}
