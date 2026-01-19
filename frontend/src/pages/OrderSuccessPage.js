import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { CheckCircle } from 'lucide-react';

const OrderSuccessPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const restaurantId = searchParams.get('restaurant_id');
  const tableNo = searchParams.get('table_no');

  const handleViewOrders = () => {
    if (restaurantId && tableNo) {
      navigate(`/my-orders/${restaurantId}/${tableNo}`);
    }
  };

  const handleOrderMore = () => {
    if (restaurantId && tableNo) {
      navigate(`/menu/${restaurantId}/${tableNo}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-green-800 dark:text-green-200">
            Order Placed Successfully!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-gray-600 dark:text-gray-400">
            Your order has been received and is being prepared.
          </p>
          <div className="space-y-3">
            <Button
              onClick={handleViewOrders}
              className="w-full"
              disabled={!restaurantId || !tableNo}
            >
              View My Orders
            </Button>
            <Button
              onClick={handleOrderMore}
              variant="outline"
              className="w-full"
              disabled={!restaurantId || !tableNo}
            >
              Order More
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderSuccessPage;