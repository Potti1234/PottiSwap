import { useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Plus, ArrowRight, Clock, AlertCircle, CheckCircle } from 'lucide-react'

// Common chain configurations
const SUPPORTED_CHAINS = [
  { id: 1, name: 'Ethereum Mainnet', symbol: 'ETH', isTestnet: false },
  { id: 11155111, name: 'Sepolia Testnet', symbol: 'ETH', isTestnet: true },
  { id: 84532, name: 'Base Sepolia Testnet', symbol: 'ETH', isTestnet: true },
  { id: 8453, name: 'Base', symbol: 'ETH', isTestnet: false },
] as const

// Common token configurations (for demo purposes)
const COMMON_TOKENS = {
  1: [ // Ethereum Mainnet
    { address: '0xA0b86a33E6441b8c4C8C8C8C8C8C8C8C8C8C8C8', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', decimals: 18, name: 'Dai Stablecoin' },
    { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', decimals: 18, name: 'Ethereum', isNative: true },
  ],
  11155111: [ // Sepolia Testnet
    { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', symbol: 'USDC', decimals: 6, name: 'USD Coin (Test)' },
    { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', decimals: 18, name: 'Ethereum', isNative: true },
  ],
  84532: [ // Base Sepolia Testnet
    { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7c', symbol: 'USDC', decimals: 6, name: 'USD Coin (Test)' },
    { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', decimals: 18, name: 'Ethereum', isNative: true },
  ],
  8453: [ // Base
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', decimals: 18, name: 'Ethereum', isNative: true },
  ],
} as const

interface SwapOrderForm {
  // Source chain details
  srcChainId: number
  srcToken: string
  srcAmount: string
  
  // Destination chain details
  dstChainId: number
  dstToken: string
  dstAmount: string
  
  // Timelock configuration
  srcWithdrawal: number
  srcPublicWithdrawal: number
  srcCancellation: number
  srcPublicCancellation: number
  dstWithdrawal: number
  dstPublicWithdrawal: number
  dstCancellation: number
  
  // Optional metadata
  notes: string
  tags: string[]
  expiresAt: number | null
}

const DEFAULT_TIMELOCKS = {
  srcWithdrawal: 3600, // 1 hour
  srcPublicWithdrawal: 7200, // 2 hours
  srcCancellation: 1800, // 30 minutes
  srcPublicCancellation: 3600, // 1 hour
  dstWithdrawal: 3600, // 1 hour
  dstPublicWithdrawal: 7200, // 2 hours
  dstCancellation: 1800, // 30 minutes
}

export function SwapOrderCreationCard() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  
  const [form, setForm] = useState<SwapOrderForm>({
    srcChainId: 11155111, // Default to Sepolia
    srcToken: '0x0000000000000000000000000000000000000000',
    srcAmount: '',
    dstChainId: 84532, // Default to Base Sepolia
    dstToken: '0x0000000000000000000000000000000000000000',
    dstAmount: '',
    ...DEFAULT_TIMELOCKS,
    notes: '',
    tags: [],
    expiresAt: null,
  })
  
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Convex mutations
  const createSwapOrder = useMutation(api.swapOrders.createSwapOrder)

  // Get available tokens for a chain
  const getTokensForChain = (chainId: number) => {
    return COMMON_TOKENS[chainId as keyof typeof COMMON_TOKENS] || []
  }

  // Get token details
  const getTokenDetails = (chainId: number, tokenAddress: string) => {
    const tokens = getTokensForChain(chainId)
    return tokens.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase())
  }

  // Generate order ID and hash (in real implementation, this would be done on-chain)
  const generateOrderId = () => {
    return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  const generateOrderHash = () => {
    return `0x${Math.random().toString(16).substr(2, 64)}`
  }

  // Convert amount to wei
  const amountToWei = (amount: string, decimals: number) => {
    if (!amount) return '0'
    const multiplier = Math.pow(10, decimals)
    return (parseFloat(amount) * multiplier).toString()
  }

  // Handle form submission
  const handleCreateOrder = async () => {
    if (!isConnected || !address) {
      setError('Please connect your wallet first')
      return
    }

    if (!form.srcAmount || !form.dstAmount) {
      setError('Please enter amounts for both source and destination')
      return
    }

    if (form.srcChainId === form.dstChainId) {
      setError('Source and destination chains must be different')
      return
    }

    setIsCreating(true)
    setError(null)
    setSuccess(null)

    try {
      const srcTokenDetails = getTokenDetails(form.srcChainId, form.srcToken)
      const dstTokenDetails = getTokenDetails(form.dstChainId, form.dstToken)

      if (!srcTokenDetails || !dstTokenDetails) {
        throw new Error('Invalid token selection')
      }

      const orderId = generateOrderId()
      const orderHash = generateOrderHash()

      await createSwapOrder({
        orderId,
        orderHash,
        creator: address,
        creatorName: 'User',
        srcChainId: form.srcChainId,
        srcToken: form.srcToken,
        srcTokenSymbol: srcTokenDetails.symbol,
        srcTokenDecimals: srcTokenDetails.decimals,
        srcAmount: form.srcAmount,
        srcAmountWei: amountToWei(form.srcAmount, srcTokenDetails.decimals),
        dstChainId: form.dstChainId,
        dstToken: form.dstToken,
        dstTokenSymbol: dstTokenDetails.symbol,
        dstTokenDecimals: dstTokenDetails.decimals,
        dstAmount: form.dstAmount,
        dstAmountWei: amountToWei(form.dstAmount, dstTokenDetails.decimals),
        srcWithdrawal: form.srcWithdrawal,
        srcPublicWithdrawal: form.srcPublicWithdrawal,
        srcCancellation: form.srcCancellation,
        srcPublicCancellation: form.srcPublicCancellation,
        dstWithdrawal: form.dstWithdrawal,
        dstPublicWithdrawal: form.dstPublicWithdrawal,
        dstCancellation: form.dstCancellation,
        notes: form.notes || undefined,
        tags: form.tags.length > 0 ? form.tags : undefined,
        expiresAt: form.expiresAt || undefined,
      })

      setSuccess(`Swap order created successfully! Order ID: ${orderId}`)
      
      // Reset form
      setForm({
        srcChainId: 11155111,
        srcToken: '0x0000000000000000000000000000000000000000',
        srcAmount: '',
        dstChainId: 84532,
        dstToken: '0x0000000000000000000000000000000000000000',
        dstAmount: '',
        ...DEFAULT_TIMELOCKS,
        notes: '',
        tags: [],
        expiresAt: null,
      })

    } catch (err) {
      console.error('Error creating swap order:', err)
      setError(err instanceof Error ? err.message : 'Failed to create swap order')
    } finally {
      setIsCreating(false)
    }
  }

  // Format time duration
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
    return `${Math.floor(seconds / 86400)}d`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Create Swap Order
        </CardTitle>
        <CardDescription>
          Create a new cross-chain swap order. Configure source and destination chains, tokens, amounts, and timelocks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Error/Success Messages */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Source Chain Configuration */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Source Chain</Badge>
            <ArrowRight className="w-4 h-4" />
            <Badge variant="outline">Destination Chain</Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Source Chain */}
            <div className="space-y-3">
              <Label htmlFor="srcChain">Source Chain</Label>
              <Select
                value={form.srcChainId.toString()}
                onValueChange={(value: string) => {
                  const chainId = parseInt(value)
                  setForm(prev => ({
                    ...prev,
                    srcChainId: chainId,
                    srcToken: getTokensForChain(chainId)[0]?.address || '0x0000000000000000000000000000000000000000'
                  }))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source chain" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CHAINS.map((chain) => (
                    <SelectItem key={chain.id} value={chain.id.toString()}>
                      {chain.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Label htmlFor="srcToken">Source Token</Label>
              <Select
                value={form.srcToken}
                onValueChange={(value: string) => setForm(prev => ({ ...prev, srcToken: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source token" />
                </SelectTrigger>
                <SelectContent>
                  {getTokensForChain(form.srcChainId).map((token) => (
                    <SelectItem key={token.address} value={token.address}>
                      {token.symbol} - {token.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Label htmlFor="srcAmount">Source Amount</Label>
              <Input
                id="srcAmount"
                type="number"
                placeholder="0.0"
                value={form.srcAmount}
                onChange={(e) => setForm(prev => ({ ...prev, srcAmount: e.target.value }))}
              />
            </div>

            {/* Destination Chain */}
            <div className="space-y-3">
              <Label htmlFor="dstChain">Destination Chain</Label>
              <Select
                value={form.dstChainId.toString()}
                onValueChange={(value: string) => {
                  const chainId = parseInt(value)
                  setForm(prev => ({
                    ...prev,
                    dstChainId: chainId,
                    dstToken: getTokensForChain(chainId)[0]?.address || '0x0000000000000000000000000000000000000000'
                  }))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select destination chain" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CHAINS.map((chain) => (
                    <SelectItem key={chain.id} value={chain.id.toString()}>
                      {chain.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Label htmlFor="dstToken">Destination Token</Label>
              <Select
                value={form.dstToken}
                onValueChange={(value: string) => setForm(prev => ({ ...prev, dstToken: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select destination token" />
                </SelectTrigger>
                <SelectContent>
                  {getTokensForChain(form.dstChainId).map((token) => (
                    <SelectItem key={token.address} value={token.address}>
                      {token.symbol} - {token.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Label htmlFor="dstAmount">Destination Amount</Label>
              <Input
                id="dstAmount"
                type="number"
                placeholder="0.0"
                value={form.dstAmount}
                onChange={(e) => setForm(prev => ({ ...prev, dstAmount: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Timelock Configuration */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <Label className="text-base font-semibold">Timelock Configuration</Label>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Source Chain Timelocks */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Source Chain Timelocks</Label>
              
              <div className="space-y-2">
                <Label htmlFor="srcWithdrawal" className="text-xs">Withdrawal (seconds)</Label>
                <Input
                  id="srcWithdrawal"
                  type="number"
                  value={form.srcWithdrawal}
                  onChange={(e) => setForm(prev => ({ ...prev, srcWithdrawal: parseInt(e.target.value) || 0 }))}
                />
                <span className="text-xs text-muted-foreground">{formatDuration(form.srcWithdrawal)}</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="srcPublicWithdrawal" className="text-xs">Public Withdrawal (seconds)</Label>
                <Input
                  id="srcPublicWithdrawal"
                  type="number"
                  value={form.srcPublicWithdrawal}
                  onChange={(e) => setForm(prev => ({ ...prev, srcPublicWithdrawal: parseInt(e.target.value) || 0 }))}
                />
                <span className="text-xs text-muted-foreground">{formatDuration(form.srcPublicWithdrawal)}</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="srcCancellation" className="text-xs">Cancellation (seconds)</Label>
                <Input
                  id="srcCancellation"
                  type="number"
                  value={form.srcCancellation}
                  onChange={(e) => setForm(prev => ({ ...prev, srcCancellation: parseInt(e.target.value) || 0 }))}
                />
                <span className="text-xs text-muted-foreground">{formatDuration(form.srcCancellation)}</span>
              </div>
            </div>

            {/* Destination Chain Timelocks */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Destination Chain Timelocks</Label>
              
              <div className="space-y-2">
                <Label htmlFor="dstWithdrawal" className="text-xs">Withdrawal (seconds)</Label>
                <Input
                  id="dstWithdrawal"
                  type="number"
                  value={form.dstWithdrawal}
                  onChange={(e) => setForm(prev => ({ ...prev, dstWithdrawal: parseInt(e.target.value) || 0 }))}
                />
                <span className="text-xs text-muted-foreground">{formatDuration(form.dstWithdrawal)}</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dstPublicWithdrawal" className="text-xs">Public Withdrawal (seconds)</Label>
                <Input
                  id="dstPublicWithdrawal"
                  type="number"
                  value={form.dstPublicWithdrawal}
                  onChange={(e) => setForm(prev => ({ ...prev, dstPublicWithdrawal: parseInt(e.target.value) || 0 }))}
                />
                <span className="text-xs text-muted-foreground">{formatDuration(form.dstPublicWithdrawal)}</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dstCancellation" className="text-xs">Cancellation (seconds)</Label>
                <Input
                  id="dstCancellation"
                  type="number"
                  value={form.dstCancellation}
                  onChange={(e) => setForm(prev => ({ ...prev, dstCancellation: parseInt(e.target.value) || 0 }))}
                />
                <span className="text-xs text-muted-foreground">{formatDuration(form.dstCancellation)}</span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Optional Metadata */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">Optional Metadata</Label>
          
          <div className="space-y-3">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this swap order..."
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="expiresAt">Expiration (optional)</Label>
            <Input
              id="expiresAt"
              type="datetime-local"
              onChange={(e) => {
                const timestamp = e.target.value ? new Date(e.target.value).getTime() : null
                setForm(prev => ({ ...prev, expiresAt: timestamp }))
              }}
            />
          </div>
        </div>

        {/* Order Preview */}
        {form.srcAmount && form.dstAmount && (
          <div className="space-y-4">
            <Separator />
            <div className="space-y-3">
              <Label className="text-base font-semibold">Order Preview</Label>
              <div className="p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {form.srcAmount} {getTokenDetails(form.srcChainId, form.srcToken)?.symbol}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {form.dstAmount} {getTokenDetails(form.dstChainId, form.dstToken)?.symbol}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {SUPPORTED_CHAINS.find(c => c.id === form.srcChainId)?.name} → {SUPPORTED_CHAINS.find(c => c.id === form.dstChainId)?.name}
                </div>
                {form.notes && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Note: {form.notes}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <Button
          onClick={handleCreateOrder}
          disabled={!isConnected || isCreating || !form.srcAmount || !form.dstAmount}
          className="w-full"
        >
          {isCreating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating Order...
            </>
          ) : (
            'Create Swap Order'
          )}
        </Button>
      </CardContent>
    </Card>
  )
} 