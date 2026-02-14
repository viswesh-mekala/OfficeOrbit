import { Dashboard } from '../screens/dashboard/DashboardScreen';
import { BottomLayout } from '../components/layout/BottomLayout';

export default function DashboardRoute() {
    return (
        <BottomLayout>
            <Dashboard />
        </BottomLayout>
    );
}
