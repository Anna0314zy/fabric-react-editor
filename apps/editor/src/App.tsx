import { Button, Space, Typography } from 'antd';
import { useCounterStore } from '@/store';

const { Title, Text } = Typography;

function App() {
  const { count, increment, decrement, reset } = useCounterStore();

  return (
    <div style={{ padding: '2rem' }}>
      <Title>Fabric React Editor</Title>
      <Text>Zustand Counter: {count}</Text>
      <Space style={{ marginTop: '1rem' }}>
        <Button type="primary" onClick={increment}>
          +1
        </Button>
        <Button onClick={decrement}>-1</Button>
        <Button danger onClick={reset}>
          Reset
        </Button>
      </Space>
    </div>
  );
}

export default App;
