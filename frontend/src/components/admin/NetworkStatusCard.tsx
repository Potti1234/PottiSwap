import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { CheckCircle, XCircle } from 'lucide-react'
import { SUPPORTED_CHAINS } from '../../constants/supported_chains'

interface NetworkStatusCardProps {
  chainId: number | undefined
  isConnected: boolean
}

export function NetworkStatusCard({ chainId, isConnected }: NetworkStatusCardProps) {
  const getChainName = (chainId: number) => {
    return SUPPORTED_CHAINS.find(c => c.id === chainId)?.name || `Chain ${chainId}`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current Network</CardTitle>
        <CardDescription>Use the wallet's network selector to switch networks</CardDescription>
      </CardHeader>
      <CardContent>
        {chainId ? (
          <div className="flex items-center space-x-3">
            <Badge variant="outline">
              {getChainName(chainId)}
            </Badge>
            {SUPPORTED_CHAINS.some(chain => chain.id === chainId) ? (
              <Badge variant="default" className="flex items-center space-x-1">
                <CheckCircle className="w-3 h-3" />
                <span>Supported</span>
              </Badge>
            ) : (
              <Badge variant="destructive" className="flex items-center space-x-1">
                <XCircle className="w-3 h-3" />
                <span>Not Supported</span>
              </Badge>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">Connect your wallet to see network status</p>
        )}
        <p className="text-sm text-muted-foreground mt-2">
          Supported networks: Sepolia Testnet
        </p>
      </CardContent>
    </Card>
  )
} 