import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Separator } from '../components/ui/separator'
import { Loader2, CheckCircle, XCircle, ExternalLink, Copy } from 'lucide-react'

export const Route = createFileRoute('/admin')({
  component: RouteComponent,
})

// Contract types for deployment
const CONTRACT_TYPES = [
  { id: 'EscrowFactory', name: 'Escrow Factory', description: 'Main factory contract for creating escrows' },
  { id: 'EscrowSrc', name: 'Escrow Source', description: 'Source chain escrow implementation' },
  { id: 'EscrowDst', name: 'Escrow Destination', description: 'Destination chain escrow implementation' },
] as const

// Common chain configurations
const SUPPORTED_CHAINS = [
  { id: 1, name: 'Ethereum Mainnet', symbol: 'ETH', isTestnet: false },
  { id: 11155111, name: 'Sepolia Testnet', symbol: 'ETH', isTestnet: true }
] as const

function RouteComponent() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  
  // State management
  const [deploymentStatus, setDeploymentStatus] = useState<Record<string, 'idle' | 'deploying' | 'success' | 'error'>>({})
  const [deploymentResults, setDeploymentResults] = useState<Record<string, { address: string; txHash: string }>>({})
  const [errorMessages, setErrorMessages] = useState<Record<string, string>>({})

  // Convex queries and mutations
  const deployedContracts = useQuery(api.contractDeployment.getDeployedContracts, {
    chainId: chainId || undefined,
    activeOnly: true
  })
  const chainConfigs = useQuery(api.contractDeployment.getChainConfigs, { activeOnly: true })
  const storeDeployedContract = useMutation(api.contractDeployment.storeDeployedContract)

  // Handle contract deployment
  const handleDeployContract = async (contractType: string) => {
    if (!chainId) {
      setErrorMessages(prev => ({ ...prev, [contractType]: 'Please connect to a supported network' }))
      return
    }

    if (!isConnected) {
      setErrorMessages(prev => ({ ...prev, [contractType]: 'Please connect your wallet first' }))
      return
    }

    // Check if current chain is supported
    const isSupportedChain = SUPPORTED_CHAINS.some(chain => chain.id === chainId)
    if (!isSupportedChain) {
      setErrorMessages(prev => ({ ...prev, [contractType]: 'Please switch to a supported network (Sepolia Testnet)' }))
      return
    }

    setDeploymentStatus(prev => ({ ...prev, [contractType]: 'deploying' }))
    setErrorMessages(prev => ({ ...prev, [contractType]: '' }))

    try {
      // TODO: Implement actual contract deployment with wagmi
      // This is a placeholder for the deployment logic
      console.log(`Deploying ${contractType} on chain ${chainId}`)
      
      // Simulate deployment (replace with actual wagmi deployment)
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Mock deployment result
      const mockAddress = `0x${Math.random().toString(16).substring(2, 42)}`
      const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`
      
      // Store in Convex
      await storeDeployedContract({
        contractType: contractType as 'EscrowFactory' | 'EscrowSrc' | 'EscrowDst',
        contractAddress: mockAddress,
        chainId: chainId,
        deployer: address!,
        deployerName: 'Admin User',
        transactionHash: mockTxHash,
        blockNumber: Math.floor(Math.random() * 1000000),
        deploymentTimestamp: Date.now(),
        networkName: SUPPORTED_CHAINS.find(c => c.id === chainId)?.name || 'Unknown',
        deployedBy: address!,
      })

      setDeploymentResults(prev => ({ 
        ...prev, 
        [contractType]: { address: mockAddress, txHash: mockTxHash } 
      }))
      setDeploymentStatus(prev => ({ ...prev, [contractType]: 'success' }))
      
    } catch (error) {
      console.error(`Error deploying ${contractType}:`, error)
      setErrorMessages(prev => ({ 
        ...prev, 
        [contractType]: error instanceof Error ? error.message : 'Deployment failed' 
      }))
      setDeploymentStatus(prev => ({ ...prev, [contractType]: 'error' }))
    }
  }

  // Copy to clipboard utility
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // Get chain name by ID
  const getChainName = (chainId: number) => {
    return SUPPORTED_CHAINS.find(c => c.id === chainId)?.name || `Chain ${chainId}`
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">PottiSwap Admin</h1>
          <p className="text-muted-foreground">Deploy and manage cross-chain swap contracts</p>
        </div>
        <div className="flex items-center space-x-2">
          {isConnected ? (
            <Badge variant="default" className="flex items-center space-x-1">
              <CheckCircle className="w-3 h-3" />
              <span>Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</span>
            </Badge>
          ) : (
            <Badge variant="destructive" className="flex items-center space-x-1">
              <XCircle className="w-3 h-3" />
              <span>Wallet not connected</span>
            </Badge>
          )}
        </div>
      </div>

      <Separator />

      {/* Current Network Status */}
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

      {/* Contract Deployment */}
      <Card>
        <CardHeader>
          <CardTitle>Contract Deployment</CardTitle>
          <CardDescription>Deploy the required contracts for cross-chain swaps</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {CONTRACT_TYPES.map((contract) => {
              const status = deploymentStatus[contract.id] || 'idle'
              const result = deploymentResults[contract.id]
              const error = errorMessages[contract.id]
                             const isDeployed = deployedContracts?.some(c => 
                 c.contractType === contract.id && c.chainId === chainId
               )

              return (
                <Card key={contract.id} className="relative">
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
                       onClick={() => handleDeployContract(contract.id)}
                       disabled={!chainId || !isConnected || status === 'deploying' || isDeployed}
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
                            onClick={() => copyToClipboard(result.address)}
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
                            onClick={() => copyToClipboard(result.txHash)}
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
            })}
          </div>
        </CardContent>
      </Card>

      {/* Deployed Contracts Overview */}
      {deployedContracts && deployedContracts.length > 0 && (
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
                      onClick={() => copyToClipboard(contract.contractAddress)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(contract.transactionHash)}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
