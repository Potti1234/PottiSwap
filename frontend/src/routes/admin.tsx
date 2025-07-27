import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Badge } from '../components/ui/badge'
import { Separator } from '../components/ui/separator'
import { CheckCircle, XCircle } from 'lucide-react'
import { 
  useDeployTestEscrowFactory, 
  useDeployResolver, 
  useWaitForDeployment,
  SEPOLIA_DEPLOYMENT_CONFIG,
  createResolverDeploymentConfig
} from '../lib/contractDeployment'
import {
  NetworkStatusCard,
  ContractDeploymentCard,
  DeployedContractsOverview
} from '../components/admin'

export const Route = createFileRoute('/admin')({
  component: RouteComponent,
})

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

  // Wagmi deployment hooks
  const { 
    deployTestEscrowFactory, 
    hash: factoryHash, 
    isPending: factoryPending, 
    error: factoryError 
  } = useDeployTestEscrowFactory()
  
  const { 
    deployResolver, 
    hash: resolverHash, 
    isPending: resolverPending, 
    error: resolverError 
  } = useDeployResolver()

  // Wait for deployment receipts
  const { 
    receipt: factoryReceipt, 
    isError: factoryReceiptError, 
    isLoading: factoryReceiptLoading,
    contractAddress: factoryAddress 
  } = useWaitForDeployment(factoryHash)
  
  const { 
    receipt: resolverReceipt, 
    isError: resolverReceiptError, 
    isLoading: resolverReceiptLoading,
    contractAddress: resolverAddress 
  } = useWaitForDeployment(resolverHash)

  // Convex queries and mutations
  const deployedContracts = useQuery(api.contractDeployment.getDeployedContracts, {
    chainId: chainId || undefined,
    activeOnly: true
  })
  const chainConfigs = useQuery(api.contractDeployment.getChainConfigs, { activeOnly: true })
  const storeDeployedContract = useMutation(api.contractDeployment.storeDeployedContract)

  // Handle deployment results and store in Convex
  useEffect(() => {
    if (factoryReceipt && factoryAddress && !factoryReceiptError) {
      // Store TestEscrowFactory deployment
      storeDeployedContract({
        contractType: 'TestEscrowFactory',
        contractAddress: factoryAddress,
        chainId: chainId!,
        deployer: address!,
        deployerName: 'Admin User',
        transactionHash: factoryHash!,
        blockNumber: Number(factoryReceipt.blockNumber),
        deploymentTimestamp: Date.now(),
        networkName: SUPPORTED_CHAINS.find(c => c.id === chainId)?.name || 'Unknown',
        deployedBy: address!,
      }).then(() => {
        setDeploymentResults(prev => ({ 
          ...prev, 
          'TestEscrowFactory': { address: factoryAddress, txHash: factoryHash! } 
        }))
        setDeploymentStatus(prev => ({ ...prev, 'TestEscrowFactory': 'success' }))
      })
    }
  }, [factoryReceipt, factoryAddress, factoryReceiptError, factoryHash, chainId, address, storeDeployedContract])

  useEffect(() => {
    if (resolverReceipt && resolverAddress && !resolverReceiptError) {
      // Store Resolver deployment
      storeDeployedContract({
        contractType: 'Resolver',
        contractAddress: resolverAddress,
        chainId: chainId!,
        deployer: address!,
        deployerName: 'Admin User',
        transactionHash: resolverHash!,
        blockNumber: Number(resolverReceipt.blockNumber),
        deploymentTimestamp: Date.now(),
        networkName: SUPPORTED_CHAINS.find(c => c.id === chainId)?.name || 'Unknown',
        deployedBy: address!,
      }).then(() => {
        setDeploymentResults(prev => ({ 
          ...prev, 
          'Resolver': { address: resolverAddress, txHash: resolverHash! } 
        }))
        setDeploymentStatus(prev => ({ ...prev, 'Resolver': 'success' }))
      })
    }
  }, [resolverReceipt, resolverAddress, resolverReceiptError, resolverHash, chainId, address, storeDeployedContract])

  // Handle deployment errors
  useEffect(() => {
    if (factoryError) {
      setErrorMessages(prev => ({ 
        ...prev, 
        'TestEscrowFactory': factoryError.message || 'Factory deployment failed' 
      }))
      setDeploymentStatus(prev => ({ ...prev, 'TestEscrowFactory': 'error' }))
    }
  }, [factoryError])

  useEffect(() => {
    if (resolverError) {
      setErrorMessages(prev => ({ 
        ...prev, 
        'Resolver': resolverError.message || 'Resolver deployment failed' 
      }))
      setDeploymentStatus(prev => ({ ...prev, 'Resolver': 'error' }))
    }
  }, [resolverError])

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
      if (contractType === 'TestEscrowFactory') {
        // Deploy TestEscrowFactory
        const config = {
          ...SEPOLIA_DEPLOYMENT_CONFIG,
          owner: address as `0x${string}`,
        }
        
        await deployTestEscrowFactory(config)
        
      } else if (contractType === 'Resolver') {
        // Get the deployed TestEscrowFactory address first
        const factoryContract = deployedContracts?.find(c => 
          c.contractType === 'TestEscrowFactory' && c.chainId === chainId
        )
        
        if (!factoryContract) {
          throw new Error('TestEscrowFactory must be deployed first')
        }
        
        const config = createResolverDeploymentConfig(
          factoryContract.contractAddress as `0x${string}`,
          SEPOLIA_DEPLOYMENT_CONFIG.limitOrderProtocol,
          address as `0x${string}`
        )
        
        await deployResolver(config)
      }
      
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
      <NetworkStatusCard chainId={chainId} isConnected={isConnected} />

      {/* Contract Deployment */}
      <ContractDeploymentCard
        chainId={chainId}
        isConnected={isConnected}
        deploymentStatus={deploymentStatus}
        deploymentResults={deploymentResults}
        errorMessages={errorMessages}
        deployedContracts={deployedContracts}
        onDeploy={handleDeployContract}
        onCopyAddress={copyToClipboard}
        onCopyTxHash={copyToClipboard}
      />

      {/* Deployed Contracts Overview */}
      <DeployedContractsOverview
        deployedContracts={deployedContracts}
        onCopyAddress={copyToClipboard}
        onCopyTxHash={copyToClipboard}
      />
    </div>
  )
}
