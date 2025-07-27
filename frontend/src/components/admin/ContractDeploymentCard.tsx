import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { ContractDeploymentButton } from './ContractDeploymentButton'

// Contract types for deployment
type ContractType = 'TestEscrowFactory' | 'Resolver'

interface ContractTypeConfig {
  id: ContractType
  name: string
  description: string
}

const CONTRACT_TYPES: ContractTypeConfig[] = [
  { id: 'TestEscrowFactory', name: 'Test Escrow Factory', description: 'Main factory contract for creating escrows' },
  { id: 'Resolver', name: 'Resolver', description: 'Resolver contract for handling swap logic' },
]

interface ContractDeploymentCardProps {
  chainId: number | undefined
  isConnected: boolean | undefined
  deploymentStatus: Record<string, 'idle' | 'deploying' | 'success' | 'error'>
  deploymentResults: Record<string, { address: string; txHash: string }>
  errorMessages: Record<string, string>
  deployedContracts: any[] | undefined
  onDeploy: (contractType: string) => void
  onCopyAddress: (text: string) => void
  onCopyTxHash: (text: string) => void
}

export function ContractDeploymentCard({
  chainId,
  isConnected,
  deploymentStatus,
  deploymentResults,
  errorMessages,
  deployedContracts,
  onDeploy,
  onCopyAddress,
  onCopyTxHash
}: ContractDeploymentCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contract Deployment</CardTitle>
        <CardDescription>Deploy the required contracts for cross-chain swaps</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CONTRACT_TYPES.map((contract) => {
            const status = contract.id === 'TestEscrowFactory' 
              ? (deploymentStatus[contract.id] || 'idle')
              : contract.id === 'Resolver'
              ? (deploymentStatus[contract.id] || 'idle')
              : deploymentStatus[contract.id] || 'idle'
            const result = deploymentResults[contract.id]
            const error = errorMessages[contract.id]
            const isDeployed = deployedContracts?.some(c => 
              c.contractType === contract.id && c.chainId === chainId
            )

            return (
              <ContractDeploymentButton
                key={contract.id}
                contract={contract}
                status={status}
                isDeployed={isDeployed}
                isDisabled={Boolean(!chainId || !isConnected)}
                error={error}
                result={result}
                onDeploy={onDeploy}
                onCopyAddress={onCopyAddress}
                onCopyTxHash={onCopyTxHash}
              />
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
} 