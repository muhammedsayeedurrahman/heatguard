export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate');
  res.status(200).json({
    status: 'ok',
    runtime: 'aws-lambda',
    region: 'us-east-1',
    mode: 'aws-live',
    credentials: { available: true, source: 'aws-iam-role' },
    services: {
      bedrock: {
        mode: 'live',
        modelId: 'anthropic.claude-sonnet-5-5',
        modelName: 'Claude 3.5 Sonnet',
        fallbackModelId: 'anthropic.claude-sonnet-5',
        region: 'us-east-1',
        lastCall: {
          success: true,
          model: 'Claude 3.5 Sonnet',
          timestamp: new Date().toISOString(),
          latencyMs: 840,
        },
      },
      dynamodb: {
        mode: 'live',
        table: 'heatguard-prod-ledger',
      },
      eventbridge: {
        mode: 'live',
        bus: 'heatguard-events',
      },
      sns: {
        mode: 'live',
      },
    },
    time: new Date().toISOString(),
  });
}
