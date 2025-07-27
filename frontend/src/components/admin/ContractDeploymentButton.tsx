import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Loader2, CheckCircle, Copy, ExternalLink } from 'lucide-react'

interface ContractDeploymentButtonProps {
  contract: {
    id: string
    name: string
    description: string
  }
  status: 'idle' | 'deploying' | 'success' | 'error'
  isDeployed: boolean
  isDisabled: boolean | undefined
  error?: string
  result?: {
    address: string
    txHash: string
  }
  onDeploy: (contractType: string) => void
  onCopyAddress: (text: string) => void
  onCopyTxHash: (text: string) => void
}

export function ContractDeploymentButton({
  contract,
  status,
  isDeployed,
  isDisabled,
  error,
  result,
  onDeploy,
  onCopyAddress,
  onCopyTxHash
}: ContractDeploymentButtonProps) {
  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{contract.name}</CardTitle>
          {isDeployed && (
            <Badge variant="default" className="flex items-center space-x-1">
              <CheckCircle className="w-3 h-3" />
              <span>Deployed</span>
            </Badge>
          )}
        </div>
        <CardDescription className="text-sm">{contract.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          onClick={() => onDeploy(contract.id)}
          disabled={isDisabled || status === 'deploying' || isDeployed}
          className="w-full"
        >
          {status === 'deploying' ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Deploying...
            </>
          ) : isDeployed ? (
            'Already Deployed'
          ) : (
            'Deploy Contract'
          )}
        </Button>

        {error && (
          <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">Contract Address:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopyAddress(result.address)}
                className="h-6 px-2"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
            </div>
            <code className="block p-2 bg-muted rounded text-xs break-all">
              {result.address}
            </code>
            
            <div className="flex items-center justify-between">
              <span className="font-medium">Transaction:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopyTxHash(result.txHash)}
                className="h-6 px-2"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                View
              </Button>
            </div>
            <code className="block p-2 bg-muted rounded text-xs break-all">
              {result.txHash}
            </code>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 