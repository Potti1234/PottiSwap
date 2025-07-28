import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Copy, ExternalLink } from 'lucide-react'
import { SUPPORTED_CHAINS } from '../../constants/supported_chains'

interface DeployedContractsOverviewProps {
  deployedContracts: any[] | undefined
  onCopyAddress: (text: string) => void
  onCopyTxHash: (text: string) => void
}

export function DeployedContractsOverview({
  deployedContracts,
  onCopyAddress,
  onCopyTxHash
}: DeployedContractsOverviewProps) {
  const getChainName = (chainId: number) => {
    return SUPPORTED_CHAINS.find(c => c.id === chainId)?.name || `Chain ${chainId}`
  }

  if (!deployedContracts || deployedContracts.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deployed Contracts</CardTitle>
        <CardDescription>Overview of all deployed contracts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {deployedContracts.map((contract) => (
            <div key={contract._id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Badge variant="outline">{contract.contractType}</Badge>
                <span className="text-sm font-mono">{contract.contractAddress}</span>
                <Badge variant="secondary">{getChainName(contract.chainId)}</Badge>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCopyAddress(contract.contractAddress)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCopyTxHash(contract.transactionHash)}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
} 