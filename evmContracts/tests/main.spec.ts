import 'dotenv/config'
import {expect, jest} from '@jest/globals'

import {createServer, CreateServerReturnType} from 'prool'
import {anvil} from 'prool/instances'

import Sdk from '@1inch/cross-chain-sdk'
import {
    computeAddress,
    ContractFactory,
    JsonRpcProvider,
    MaxUint256,
    parseEther,
    parseUnits,
    randomBytes,
    Wallet as SignerWallet
} from 'ethers'
import {uint8ArrayToHex, UINT_40_MAX} from '@1inch/byte-utils'
import assert from 'node:assert'
import {ChainConfig, config} from './config'
import {Wallet} from './wallet'
import {Resolver} from './resolver'
import {EscrowFactory} from './escrow-factory'
import factoryContract from '../out/TestEscrowFactory.sol/TestEscrowFactory.json'
import resolverContract from '../out/Resolver.sol/Resolver.json'
import {AlgorandClient} from '@algorandfoundation/algokit-utils'
import {AuctionFactory as AuctionFactoryAlgo} from '../algorandArtifacts/AuctionClient'
import {EscrowFactory as EscrowFactoryAlgo} from '../algorandArtifacts/EscrowClient'
import {ResolverFactory as ResolverFactoryAlgo} from '../algorandArtifacts/ResolverClient'
import {keccak256, getBytes} from 'ethers'
import {hexToBytes} from 'algosdk'
import {AppClient} from '@algorandfoundation/algokit-utils/types/app-client'

const {Address} = Sdk

jest.setTimeout(1000 * 60)

const userPk = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
const resolverPk = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'

// eslint-disable-next-line max-lines-per-function
describe('Resolving example', () => {
    const srcChainId = config.chain.source.chainId
    const dstChainId = config.chain.destination.chainId

    type Chain = {
        node?: CreateServerReturnType | undefined
        provider: JsonRpcProvider
        escrowFactory: string
        resolver: string
    }

    let src: Chain
    let dst: Chain

    let srcChainUser: Wallet
    let dstChainUser: Wallet
    let srcChainResolver: Wallet
    let dstChainResolver: Wallet

    let srcFactory: EscrowFactory
    let dstFactory: EscrowFactory
    let srcResolverContract: Wallet
    let dstResolverContract: Wallet

    let srcTimestamp: bigint

    let algorand: AlgorandClient
    let deployerAlgorand
    let makerAlgo
    let resolverAlgorand

    let escrowAppClient: AppClient
    let auctionAppClient: AppClient
    let resolver1AppClient: AppClient

    async function increaseTime(t: number): Promise<void> {
        await Promise.all([src, dst].map((chain) => chain.provider.send('evm_increaseTime', [t])))
    }

    beforeAll(async () => {
        ;[src, dst] = await Promise.all([initChain(config.chain.source), initChain(config.chain.destination)])

        srcChainUser = new Wallet(userPk, src.provider)
        dstChainUser = new Wallet(userPk, dst.provider)
        srcChainResolver = new Wallet(resolverPk, src.provider)
        dstChainResolver = new Wallet(resolverPk, dst.provider)

        srcFactory = new EscrowFactory(src.provider, src.escrowFactory)
        dstFactory = new EscrowFactory(dst.provider, dst.escrowFactory)
        // get 1000 USDC for user in SRC chain and approve to LOP
        await srcChainUser.topUpFromDonor(
            config.chain.source.tokens.USDC.address,
            config.chain.source.tokens.USDC.donor,
            parseUnits('1000', 6)
        )
        await srcChainUser.approveToken(
            config.chain.source.tokens.USDC.address,
            config.chain.source.limitOrderProtocol,
            MaxUint256
        )

        // get 2000 USDC for resolver in DST chain
        srcResolverContract = await Wallet.fromAddress(src.resolver, src.provider)
        dstResolverContract = await Wallet.fromAddress(dst.resolver, dst.provider)
        await dstResolverContract.topUpFromDonor(
            config.chain.destination.tokens.USDC.address,
            config.chain.destination.tokens.USDC.donor,
            parseUnits('2000', 6)
        )
        // top up contract for approve
        await dstChainResolver.transfer(dst.resolver, parseEther('1'))
        await dstResolverContract.unlimitedApprove(config.chain.destination.tokens.USDC.address, dst.escrowFactory)

        srcTimestamp = BigInt((await src.provider.getBlock('latest'))!.timestamp)

        // Algorand Setup
        // Create accounts for maker, resolver and relayer on local network
        algorand = AlgorandClient.fromEnvironment()
        deployerAlgorand = await algorand.account.fromEnvironment('Deployer')
        makerAlgo = await algorand.account.fromEnvironment('maker')
        resolverAlgorand = await algorand.account.fromEnvironment('resolver')

        // deploy and fund algorand Contracts
        const escrowFactory = algorand.client.getTypedAppFactory(EscrowFactoryAlgo, {
            defaultSender: deployerAlgorand.addr
        })

        const auctionFactory = algorand.client.getTypedAppFactory(AuctionFactoryAlgo, {
            defaultSender: deployerAlgorand.addr
        })

        const resolver1factory = algorand.client.getTypedAppFactory(ResolverFactoryAlgo, {
            defaultSender: resolverAlgorand.addr
        })

        const {appClient: resolver1AppClientSaved, result: resolver1Result} = await resolver1factory.deploy({
            onUpdate: 'replace',
            onSchemaBreak: 'replace'
        })

        const {appClient: escrowAppClientSaved, result: escrowResult} = await escrowFactory.deploy({
            onUpdate: 'replace',
            onSchemaBreak: 'replace'
        })

        const {appClient: auctionAppClientSaved, result: auctionResult} = await auctionFactory.deploy({
            onUpdate: 'replace',
            onSchemaBreak: 'replace'
        })

        resolver1AppClient = resolver1AppClientSaved
        escrowAppClient = escrowAppClientSaved
        auctionAppClient = auctionAppClientSaved

        // If app was just created fund the app accounts of EscrowFactory, Resolver1 and Resolver2

        if (['create', 'replace'].includes(resolver1Result.operationPerformed)) {
            await algorand.send.payment({
                amount: (2).algo(),
                sender: deployerAlgorand.addr,
                receiver: resolver1AppClient.appAddress
            })
        }

        if (['create', 'replace'].includes(escrowResult.operationPerformed)) {
            await algorand.send.payment({
                amount: (2).algo(),
                sender: deployerAlgorand.addr,
                receiver: escrowAppClient.appAddress
            })
        }

        if (['create', 'replace'].includes(auctionResult.operationPerformed)) {
            await algorand.send.payment({
                amount: (2).algo(),
                sender: deployerAlgorand.addr,
                receiver: auctionAppClient.appAddress
            })
        }
    })

    async function getBalances(
        srcToken: string,
        dstToken: string
    ): Promise<{src: {user: bigint; resolver: bigint}; dst: {user: bigint; resolver: bigint}}> {
        return {
            src: {
                user: await srcChainUser.tokenBalance(srcToken),
                resolver: await srcResolverContract.tokenBalance(srcToken)
            },
            dst: {
                user: await dstChainUser.tokenBalance(dstToken),
                resolver: await dstResolverContract.tokenBalance(dstToken)
            }
        }
    }

    afterAll(async () => {
        src.provider.destroy()
        dst.provider.destroy()
        await Promise.all([src.node?.stop(), dst.node?.stop()])
    })

    // eslint-disable-next-line max-lines-per-function
    describe('Fill', () => {
        it('should swap Ethereum USDC -> Algo. Single fill only', async () => {
            const initialBalances = await getBalances(
                config.chain.source.tokens.USDC.address,
                config.chain.destination.tokens.USDC.address
            )

            // User creates order
            const secretRaw = crypto.getRandomValues(new Uint8Array(32))
            const secret = uint8ArrayToHex(secretRaw)
            const secretHash = hexToBytes(keccak256(secretRaw).slice(2))

            //Dont change sdk call because it doesnt support non EVM chains
            //We would need to change the sdk which would require too much work for this hackathon
            // So leave the sdk code as it is and interact directly on smart conntract level
            //Destination values here are not used
            const order = Sdk.CrossChainOrder.new(
                new Address(src.escrowFactory),
                {
                    salt: Sdk.randBigInt(1000n),
                    maker: new Address(await srcChainUser.getAddress()),
                    makingAmount: parseUnits('100', 6),
                    takingAmount: parseUnits('99', 6),
                    makerAsset: new Address(config.chain.source.tokens.USDC.address),
                    takerAsset: new Address(config.chain.destination.tokens.USDC.address)
                },
                {
                    hashLock: Sdk.HashLock.forSingleFill(secret),
                    timeLocks: Sdk.TimeLocks.new({
                        srcWithdrawal: 10n, // 10sec finality lock for test
                        srcPublicWithdrawal: 120n, // 2m for private withdrawal
                        srcCancellation: 121n, // 1sec public withdrawal
                        srcPublicCancellation: 122n, // 1sec private cancellation
                        dstWithdrawal: 10n, // 10sec finality lock for test
                        dstPublicWithdrawal: 100n, // 100sec private withdrawal
                        dstCancellation: 101n // 1sec public withdrawal
                    }),
                    srcChainId,
                    dstChainId,
                    srcSafetyDeposit: parseEther('0.001'),
                    dstSafetyDeposit: parseEther('0.001')
                },
                {
                    auction: new Sdk.AuctionDetails({
                        initialRateBump: 0,
                        points: [],
                        duration: 120n,
                        startTime: srcTimestamp
                    }),
                    whitelist: [
                        {
                            address: new Address(src.resolver),
                            allowFrom: 0n
                        }
                    ],
                    resolvingStartTime: 0n
                },
                {
                    nonce: Sdk.randBigInt(UINT_40_MAX),
                    allowPartialFills: false,
                    allowMultipleFills: false
                }
            )

            const signature = await srcChainUser.signOrder(srcChainId, order)
            const orderHash = order.getOrderHash(srcChainId)
            // Resolver fills order
            const resolverContract = new Resolver(src.resolver, dst.resolver)

            console.log(`[${srcChainId}]`, `Filling order ${orderHash}`)

            const fillAmount = order.makingAmount
            const {txHash: orderFillHash, blockHash: srcDeployBlock} = await srcChainResolver.send(
                resolverContract.deploySrc(
                    srcChainId,
                    order,
                    signature,
                    Sdk.TakerTraits.default()
                        .setExtension(order.extension)
                        .setAmountMode(Sdk.AmountMode.maker)
                        .setAmountThreshold(order.takingAmount),
                    fillAmount
                )
            )

            console.log(`[${srcChainId}]`, `Order ${orderHash} filled for ${fillAmount} in tx ${orderFillHash} on EVM`)

            const srcEscrowEvent = await srcFactory.getSrcDeployEvent(srcDeployBlock)

            // Change of code instead of fill the dst escrow on EVM we fill escrow on Algorand
            //Resolver creates Escrow based on Auction price
            const resolver1Deposit = await algorand.send.payment({
                amount: (1).algo(),
                sender: resolverAlgorand.addr,
                receiver: escrowAppClient.appAddress
            })
            //TODO Change timelock
            const resolver1Escrow = await escrowAppClient.send.create({
                args: {
                    timelock: 1000,
                    secretHash: secretHash,
                    taker: makerAlgo.addr.toString(),
                    txnDeposit: resolver1Deposit.transaction
                },
                sender: resolverAlgorand.addr,
                signer: resolverAlgorand.signer
            })

            const ESCROW_SRC_IMPLEMENTATION = await srcFactory.getSourceImpl()

            const srcEscrowAddress = new Sdk.EscrowFactory(new Address(src.escrowFactory)).getSrcEscrowAddress(
                srcEscrowEvent[0],
                ESCROW_SRC_IMPLEMENTATION
            )

            await increaseTime(11)
            // User shares key after validation of dst escrow deployment
            console.log(`[${dstChainId}]`, `Withdrawing funds for user from AlgoRAnd`)
            const escrowMakerClaim = await escrowAppClient.createTransaction.withdraw({
                args: {
                    secret: getBytes(secret),
                    escrowId: resolver1Escrow.return?.valueOf() ?? 0
                },
                sender: resolverAlgorand.addr,
                signer: resolverAlgorand.signer
            })

            console.log(`[${srcChainId}]`, `Withdrawing funds for resolver from ${srcEscrowAddress}`)
            const {txHash: resolverWithdrawHash} = await srcChainResolver.send(
                resolverContract.withdraw('src', srcEscrowAddress, secret, srcEscrowEvent[0])
            )
            console.log(
                `[${srcChainId}]`,
                `Withdrew funds for resolver from ${srcEscrowAddress} to ${src.resolver} in tx ${resolverWithdrawHash}`
            )

            const resultBalances = await getBalances(
                config.chain.source.tokens.USDC.address,
                config.chain.destination.tokens.USDC.address
            )

            // user transferred funds to resolver on source chain
            expect(initialBalances.src.user - resultBalances.src.user).toBe(order.makingAmount)
            expect(resultBalances.src.resolver - initialBalances.src.resolver).toBe(order.makingAmount)
            // resolver transferred funds to user on destination chain
            // Because User and resolver pay gas fees to fill the order we cant expect the same amount of funds on the destination chain
            // So we check if the escrowMakerClaim succeded on AlgoRand If the claim would fail the test would fail because an error would be thrown
        })

        it('should swap Algo to Bsc USDC. Single fill only', async () => {
            const initialBalances = await getBalances(
                config.chain.source.tokens.USDC.address,
                config.chain.destination.tokens.USDC.address
            )

            // User creates order
            const secretRaw = crypto.getRandomValues(new Uint8Array(32))
            const secret = uint8ArrayToHex(secretRaw)
            const secretHash = hexToBytes(keccak256(secretRaw).slice(2))

            //We dont need the SDK here because we are not using the EVM chain as source so the maker creates the Algo contracts
            // and then the Resolver can create the evm escrow
            // We still keep the sdk so that the other calls will still work but the source values here are not used
            const order = Sdk.CrossChainOrder.new(
                new Address(src.escrowFactory),
                {
                    salt: Sdk.randBigInt(1000n),
                    maker: new Address(await srcChainUser.getAddress()),
                    makingAmount: parseUnits('100', 6),
                    takingAmount: parseUnits('99', 6),
                    makerAsset: new Address(config.chain.source.tokens.USDC.address),
                    takerAsset: new Address(config.chain.destination.tokens.USDC.address)
                },
                {
                    hashLock: Sdk.HashLock.forSingleFill(secret),
                    timeLocks: Sdk.TimeLocks.new({
                        srcWithdrawal: 10n, // 10sec finality lock for test
                        srcPublicWithdrawal: 120n, // 2m for private withdrawal
                        srcCancellation: 121n, // 1sec public withdrawal
                        srcPublicCancellation: 122n, // 1sec private cancellation
                        dstWithdrawal: 10n, // 10sec finality lock for test
                        dstPublicWithdrawal: 100n, // 100sec private withdrawal
                        dstCancellation: 101n // 1sec public withdrawal
                    }),
                    srcChainId,
                    dstChainId,
                    srcSafetyDeposit: parseEther('0.001'),
                    dstSafetyDeposit: parseEther('0.001')
                },
                {
                    auction: new Sdk.AuctionDetails({
                        initialRateBump: 0,
                        points: [],
                        duration: 120n,
                        startTime: srcTimestamp
                    }),
                    whitelist: [
                        {
                            address: new Address(src.resolver),
                            allowFrom: 0n
                        }
                    ],
                    resolvingStartTime: 0n
                },
                {
                    nonce: Sdk.randBigInt(UINT_40_MAX),
                    allowPartialFills: false,
                    allowMultipleFills: false
                }
            )

            // maker creates deposit
            const deposit = await algorand.send.payment({
                amount: (1).algo(),
                sender: makerAlgo.addr,
                receiver: escrowAppClient.appAddress
            })

            //maker creates Escrow
            const escrow = await escrowAppClient.send.create({
                args: {
                    timelock: 1000,
                    secretHash: secretHash,
                    taker: resolverAlgorand.addr.toString(),
                    txnDeposit: deposit.transaction
                },
                sender: makerAlgo.addr,
                signer: makerAlgo.signer
            })

            console.log('Maker created escrow with id: ', escrow.return)

            //Relayer creates Auction with whitelisted resolvers
            const auction = await auctionAppClient.send.createAuction({
                args: {
                    startPrice: 2,
                    minPrice: 1,
                    duration: 12,
                    escrowId: escrow.return?.valueOf() ?? 0,
                    escrowAppId: escrowAppClient.appId
                },
                sender: deployerAlgorand.addr,
                signer: deployerAlgorand.signer
            })

            //Resolver bids on Auction
            const bid = await auctionAppClient.send.bid({
                args: {
                    auctionId: 0
                },
                sender: resolverAlgorand.addr,
                signer: resolverAlgorand.signer
            })

            console.log('Relayer created auction with id: ', auction.return)

            // Resolver creates Escrow on EVM based on Auction price

            const dstImmutables = srcEscrowEvent[0]
                .withComplement(srcEscrowEvent[1])
                .withTaker(new Address(resolverContract.dstAddress))

            console.log(`[${dstChainId}]`, `Depositing ${dstImmutables.amount} for order ${orderHash}`)
            const {txHash: dstDepositHash, blockTimestamp: dstDeployedAt} = await dstChainResolver.send(
                resolverContract.deployDst(dstImmutables)
            )
            console.log(`[${dstChainId}]`, `Created dst deposit for order ${orderHash} in tx ${dstDepositHash}`)

            const ESCROW_SRC_IMPLEMENTATION = await srcFactory.getSourceImpl()
            const ESCROW_DST_IMPLEMENTATION = await dstFactory.getDestinationImpl()

            const srcEscrowAddress = new Sdk.EscrowFactory(new Address(src.escrowFactory)).getSrcEscrowAddress(
                srcEscrowEvent[0],
                ESCROW_SRC_IMPLEMENTATION
            )

            const dstEscrowAddress = new Sdk.EscrowFactory(new Address(dst.escrowFactory)).getDstEscrowAddress(
                srcEscrowEvent[0],
                srcEscrowEvent[1],
                dstDeployedAt,
                new Address(resolverContract.dstAddress),
                ESCROW_DST_IMPLEMENTATION
            )

            await increaseTime(11)
            // User shares key after validation of dst escrow deployment
            console.log(`[${dstChainId}]`, `Withdrawing funds for user from ${dstEscrowAddress}`)
            await dstChainResolver.send(
                resolverContract.withdraw('dst', dstEscrowAddress, secret, dstImmutables.withDeployedAt(dstDeployedAt))
            )

            console.log(`[${srcChainId}]`, `Withdrawing funds for resolver from ${srcEscrowAddress}`)
            const {txHash: resolverWithdrawHash} = await srcChainResolver.send(
                resolverContract.withdraw('src', srcEscrowAddress, secret, srcEscrowEvent[0])
            )
            console.log(
                `[${srcChainId}]`,
                `Withdrew funds for resolver from ${srcEscrowAddress} to ${src.resolver} in tx ${resolverWithdrawHash}`
            )

            const resultBalances = await getBalances(
                config.chain.source.tokens.USDC.address,
                config.chain.destination.tokens.USDC.address
            )

            // user transferred funds to resolver on source chain
            expect(initialBalances.src.user - resultBalances.src.user).toBe(order.makingAmount)
            expect(resultBalances.src.resolver - initialBalances.src.resolver).toBe(order.makingAmount)
            // resolver transferred funds to user on destination chain
            expect(resultBalances.dst.user - initialBalances.dst.user).toBe(order.takingAmount)
            expect(initialBalances.dst.resolver - resultBalances.dst.resolver).toBe(order.takingAmount)
        })

        it('should swap Ethereum USDC -> Bsc USDC. Multiple fills. Fill 100%', async () => {
            const initialBalances = await getBalances(
                config.chain.source.tokens.USDC.address,
                config.chain.destination.tokens.USDC.address
            )

            // User creates order
            // 11 secrets
            const secrets = Array.from({length: 11}).map(() => uint8ArrayToHex(randomBytes(32))) // note: use crypto secure random number in the real world
            const secretHashes = secrets.map((s) => Sdk.HashLock.hashSecret(s))
            const leaves = Sdk.HashLock.getMerkleLeaves(secrets)
            const order = Sdk.CrossChainOrder.new(
                new Address(src.escrowFactory),
                {
                    salt: Sdk.randBigInt(1000n),
                    maker: new Address(await srcChainUser.getAddress()),
                    makingAmount: parseUnits('100', 6),
                    takingAmount: parseUnits('99', 6),
                    makerAsset: new Address(config.chain.source.tokens.USDC.address),
                    takerAsset: new Address(config.chain.destination.tokens.USDC.address)
                },
                {
                    hashLock: Sdk.HashLock.forMultipleFills(leaves),
                    timeLocks: Sdk.TimeLocks.new({
                        srcWithdrawal: 10n, // 10s finality lock for test
                        srcPublicWithdrawal: 120n, // 2m for private withdrawal
                        srcCancellation: 121n, // 1sec public withdrawal
                        srcPublicCancellation: 122n, // 1sec private cancellation
                        dstWithdrawal: 10n, // 10s finality lock for test
                        dstPublicWithdrawal: 100n, // 100sec private withdrawal
                        dstCancellation: 101n // 1sec public withdrawal
                    }),
                    srcChainId,
                    dstChainId,
                    srcSafetyDeposit: parseEther('0.001'),
                    dstSafetyDeposit: parseEther('0.001')
                },
                {
                    auction: new Sdk.AuctionDetails({
                        initialRateBump: 0,
                        points: [],
                        duration: 120n,
                        startTime: srcTimestamp
                    }),
                    whitelist: [
                        {
                            address: new Address(src.resolver),
                            allowFrom: 0n
                        }
                    ],
                    resolvingStartTime: 0n
                },
                {
                    nonce: Sdk.randBigInt(UINT_40_MAX),
                    allowPartialFills: true,
                    allowMultipleFills: true
                }
            )

            const signature = await srcChainUser.signOrder(srcChainId, order)
            const orderHash = order.getOrderHash(srcChainId)
            // Resolver fills order
            const resolverContract = new Resolver(src.resolver, dst.resolver)

            console.log(`[${srcChainId}]`, `Filling order ${orderHash}`)

            const fillAmount = order.makingAmount
            const idx = secrets.length - 1 // last index to fulfill
            // Number((BigInt(secrets.length - 1) * (fillAmount - 1n)) / order.makingAmount)

            const {txHash: orderFillHash, blockHash: srcDeployBlock} = await srcChainResolver.send(
                resolverContract.deploySrc(
                    srcChainId,
                    order,
                    signature,
                    Sdk.TakerTraits.default()
                        .setExtension(order.extension)
                        .setInteraction(
                            new Sdk.EscrowFactory(new Address(src.escrowFactory)).getMultipleFillInteraction(
                                Sdk.HashLock.getProof(leaves, idx),
                                idx,
                                secretHashes[idx]
                            )
                        )
                        .setAmountMode(Sdk.AmountMode.maker)
                        .setAmountThreshold(order.takingAmount),
                    fillAmount,
                    Sdk.HashLock.fromString(secretHashes[idx])
                )
            )

            console.log(`[${srcChainId}]`, `Order ${orderHash} filled for ${fillAmount} in tx ${orderFillHash}`)

            const srcEscrowEvent = await srcFactory.getSrcDeployEvent(srcDeployBlock)

            const dstImmutables = srcEscrowEvent[0]
                .withComplement(srcEscrowEvent[1])
                .withTaker(new Address(resolverContract.dstAddress))

            console.log(`[${dstChainId}]`, `Depositing ${dstImmutables.amount} for order ${orderHash}`)
            const {txHash: dstDepositHash, blockTimestamp: dstDeployedAt} = await dstChainResolver.send(
                resolverContract.deployDst(dstImmutables)
            )
            console.log(`[${dstChainId}]`, `Created dst deposit for order ${orderHash} in tx ${dstDepositHash}`)

            const secret = secrets[idx]

            const ESCROW_SRC_IMPLEMENTATION = await srcFactory.getSourceImpl()
            const ESCROW_DST_IMPLEMENTATION = await dstFactory.getDestinationImpl()

            const srcEscrowAddress = new Sdk.EscrowFactory(new Address(src.escrowFactory)).getSrcEscrowAddress(
                srcEscrowEvent[0],
                ESCROW_SRC_IMPLEMENTATION
            )

            const dstEscrowAddress = new Sdk.EscrowFactory(new Address(dst.escrowFactory)).getDstEscrowAddress(
                srcEscrowEvent[0],
                srcEscrowEvent[1],
                dstDeployedAt,
                new Address(resolverContract.dstAddress),
                ESCROW_DST_IMPLEMENTATION
            )

            await increaseTime(11) // finality lock passed
            // User shares key after validation of dst escrow deployment
            console.log(`[${dstChainId}]`, `Withdrawing funds for user from ${dstEscrowAddress}`)
            await dstChainResolver.send(
                resolverContract.withdraw('dst', dstEscrowAddress, secret, dstImmutables.withDeployedAt(dstDeployedAt))
            )

            console.log(`[${srcChainId}]`, `Withdrawing funds for resolver from ${srcEscrowAddress}`)
            const {txHash: resolverWithdrawHash} = await srcChainResolver.send(
                resolverContract.withdraw('src', srcEscrowAddress, secret, srcEscrowEvent[0])
            )
            console.log(
                `[${srcChainId}]`,
                `Withdrew funds for resolver from ${srcEscrowAddress} to ${src.resolver} in tx ${resolverWithdrawHash}`
            )

            const resultBalances = await getBalances(
                config.chain.source.tokens.USDC.address,
                config.chain.destination.tokens.USDC.address
            )

            // user transferred funds to resolver on the source chain
            expect(initialBalances.src.user - resultBalances.src.user).toBe(order.makingAmount)
            expect(resultBalances.src.resolver - initialBalances.src.resolver).toBe(order.makingAmount)
            // resolver transferred funds to user on the destination chain
            expect(resultBalances.dst.user - initialBalances.dst.user).toBe(order.takingAmount)
            expect(initialBalances.dst.resolver - resultBalances.dst.resolver).toBe(order.takingAmount)
        })

        it('should swap Ethereum USDC -> Bsc USDC. Multiple fills. Fill 50%', async () => {
            const initialBalances = await getBalances(
                config.chain.source.tokens.USDC.address,
                config.chain.destination.tokens.USDC.address
            )

            // User creates order
            // 11 secrets
            const secrets = Array.from({length: 11}).map(() => uint8ArrayToHex(randomBytes(32))) // note: use crypto secure random number in the real world
            const secretHashes = secrets.map((s) => Sdk.HashLock.hashSecret(s))
            const leaves = Sdk.HashLock.getMerkleLeaves(secrets)
            const order = Sdk.CrossChainOrder.new(
                new Address(src.escrowFactory),
                {
                    salt: Sdk.randBigInt(1000n),
                    maker: new Address(await srcChainUser.getAddress()),
                    makingAmount: parseUnits('100', 6),
                    takingAmount: parseUnits('99', 6),
                    makerAsset: new Address(config.chain.source.tokens.USDC.address),
                    takerAsset: new Address(config.chain.destination.tokens.USDC.address)
                },
                {
                    hashLock: Sdk.HashLock.forMultipleFills(leaves),
                    timeLocks: Sdk.TimeLocks.new({
                        srcWithdrawal: 10n, // 10s finality lock for test
                        srcPublicWithdrawal: 120n, // 2m for private withdrawal
                        srcCancellation: 121n, // 1sec public withdrawal
                        srcPublicCancellation: 122n, // 1sec private cancellation
                        dstWithdrawal: 10n, // 10s finality lock for test
                        dstPublicWithdrawal: 100n, // 100sec private withdrawal
                        dstCancellation: 101n // 1sec public withdrawal
                    }),
                    srcChainId,
                    dstChainId,
                    srcSafetyDeposit: parseEther('0.001'),
                    dstSafetyDeposit: parseEther('0.001')
                },
                {
                    auction: new Sdk.AuctionDetails({
                        initialRateBump: 0,
                        points: [],
                        duration: 120n,
                        startTime: srcTimestamp
                    }),
                    whitelist: [
                        {
                            address: new Address(src.resolver),
                            allowFrom: 0n
                        }
                    ],
                    resolvingStartTime: 0n
                },
                {
                    nonce: Sdk.randBigInt(UINT_40_MAX),
                    allowPartialFills: true,
                    allowMultipleFills: true
                }
            )

            const signature = await srcChainUser.signOrder(srcChainId, order)
            const orderHash = order.getOrderHash(srcChainId)
            // Resolver fills order
            const resolverContract = new Resolver(src.resolver, dst.resolver)

            console.log(`[${srcChainId}]`, `Filling order ${orderHash}`)

            const fillAmount = order.makingAmount / 2n
            const idx = Number((BigInt(secrets.length - 1) * (fillAmount - 1n)) / order.makingAmount)

            const {txHash: orderFillHash, blockHash: srcDeployBlock} = await srcChainResolver.send(
                resolverContract.deploySrc(
                    srcChainId,
                    order,
                    signature,
                    Sdk.TakerTraits.default()
                        .setExtension(order.extension)
                        .setInteraction(
                            new Sdk.EscrowFactory(new Address(src.escrowFactory)).getMultipleFillInteraction(
                                Sdk.HashLock.getProof(leaves, idx),
                                idx,
                                secretHashes[idx]
                            )
                        )
                        .setAmountMode(Sdk.AmountMode.maker)
                        .setAmountThreshold(order.takingAmount),
                    fillAmount,
                    Sdk.HashLock.fromString(secretHashes[idx])
                )
            )

            console.log(`[${srcChainId}]`, `Order ${orderHash} filled for ${fillAmount} in tx ${orderFillHash}`)

            const srcEscrowEvent = await srcFactory.getSrcDeployEvent(srcDeployBlock)

            const dstImmutables = srcEscrowEvent[0]
                .withComplement(srcEscrowEvent[1])
                .withTaker(new Address(resolverContract.dstAddress))

            console.log(`[${dstChainId}]`, `Depositing ${dstImmutables.amount} for order ${orderHash}`)
            const {txHash: dstDepositHash, blockTimestamp: dstDeployedAt} = await dstChainResolver.send(
                resolverContract.deployDst(dstImmutables)
            )
            console.log(`[${dstChainId}]`, `Created dst deposit for order ${orderHash} in tx ${dstDepositHash}`)

            const secret = secrets[idx]

            const ESCROW_SRC_IMPLEMENTATION = await srcFactory.getSourceImpl()
            const ESCROW_DST_IMPLEMENTATION = await dstFactory.getDestinationImpl()

            const srcEscrowAddress = new Sdk.EscrowFactory(new Address(src.escrowFactory)).getSrcEscrowAddress(
                srcEscrowEvent[0],
                ESCROW_SRC_IMPLEMENTATION
            )

            const dstEscrowAddress = new Sdk.EscrowFactory(new Address(dst.escrowFactory)).getDstEscrowAddress(
                srcEscrowEvent[0],
                srcEscrowEvent[1],
                dstDeployedAt,
                new Address(resolverContract.dstAddress),
                ESCROW_DST_IMPLEMENTATION
            )

            await increaseTime(11) // finality lock passed
            // User shares key after validation of dst escrow deployment
            console.log(`[${dstChainId}]`, `Withdrawing funds for user from ${dstEscrowAddress}`)
            await dstChainResolver.send(
                resolverContract.withdraw('dst', dstEscrowAddress, secret, dstImmutables.withDeployedAt(dstDeployedAt))
            )

            console.log(`[${srcChainId}]`, `Withdrawing funds for resolver from ${srcEscrowAddress}`)
            const {txHash: resolverWithdrawHash} = await srcChainResolver.send(
                resolverContract.withdraw('src', srcEscrowAddress, secret, srcEscrowEvent[0])
            )
            console.log(
                `[${srcChainId}]`,
                `Withdrew funds for resolver from ${srcEscrowAddress} to ${src.resolver} in tx ${resolverWithdrawHash}`
            )

            const resultBalances = await getBalances(
                config.chain.source.tokens.USDC.address,
                config.chain.destination.tokens.USDC.address
            )

            // user transferred funds to resolver on the source chain
            expect(initialBalances.src.user - resultBalances.src.user).toBe(fillAmount)
            expect(resultBalances.src.resolver - initialBalances.src.resolver).toBe(fillAmount)
            // resolver transferred funds to user on the destination chain
            const dstAmount = (order.takingAmount * fillAmount) / order.makingAmount
            expect(resultBalances.dst.user - initialBalances.dst.user).toBe(dstAmount)
            expect(initialBalances.dst.resolver - resultBalances.dst.resolver).toBe(dstAmount)
        })
    })

    describe('Cancel', () => {
        it('should cancel swap Ethereum USDC -> Bsc USDC', async () => {
            const initialBalances = await getBalances(
                config.chain.source.tokens.USDC.address,
                config.chain.destination.tokens.USDC.address
            )

            // User creates order
            const hashLock = Sdk.HashLock.forSingleFill(uint8ArrayToHex(randomBytes(32))) // note: use crypto secure random number in real world
            const order = Sdk.CrossChainOrder.new(
                new Address(src.escrowFactory),
                {
                    salt: Sdk.randBigInt(1000n),
                    maker: new Address(await srcChainUser.getAddress()),
                    makingAmount: parseUnits('100', 6),
                    takingAmount: parseUnits('99', 6),
                    makerAsset: new Address(config.chain.source.tokens.USDC.address),
                    takerAsset: new Address(config.chain.destination.tokens.USDC.address)
                },
                {
                    hashLock,
                    timeLocks: Sdk.TimeLocks.new({
                        srcWithdrawal: 0n, // no finality lock for test
                        srcPublicWithdrawal: 120n, // 2m for private withdrawal
                        srcCancellation: 121n, // 1sec public withdrawal
                        srcPublicCancellation: 122n, // 1sec private cancellation
                        dstWithdrawal: 0n, // no finality lock for test
                        dstPublicWithdrawal: 100n, // 100sec private withdrawal
                        dstCancellation: 101n // 1sec public withdrawal
                    }),
                    srcChainId,
                    dstChainId,
                    srcSafetyDeposit: parseEther('0.001'),
                    dstSafetyDeposit: parseEther('0.001')
                },
                {
                    auction: new Sdk.AuctionDetails({
                        initialRateBump: 0,
                        points: [],
                        duration: 120n,
                        startTime: srcTimestamp
                    }),
                    whitelist: [
                        {
                            address: new Address(src.resolver),
                            allowFrom: 0n
                        }
                    ],
                    resolvingStartTime: 0n
                },
                {
                    nonce: Sdk.randBigInt(UINT_40_MAX),
                    allowPartialFills: false,
                    allowMultipleFills: false
                }
            )

            const signature = await srcChainUser.signOrder(srcChainId, order)
            const orderHash = order.getOrderHash(srcChainId)
            // Resolver fills order
            const resolverContract = new Resolver(src.resolver, dst.resolver)

            console.log(`[${srcChainId}]`, `Filling order ${orderHash}`)

            const fillAmount = order.makingAmount
            const {txHash: orderFillHash, blockHash: srcDeployBlock} = await srcChainResolver.send(
                resolverContract.deploySrc(
                    srcChainId,
                    order,
                    signature,
                    Sdk.TakerTraits.default()
                        .setExtension(order.extension)
                        .setAmountMode(Sdk.AmountMode.maker)
                        .setAmountThreshold(order.takingAmount),
                    fillAmount
                )
            )

            console.log(`[${srcChainId}]`, `Order ${orderHash} filled for ${fillAmount} in tx ${orderFillHash}`)

            const srcEscrowEvent = await srcFactory.getSrcDeployEvent(srcDeployBlock)

            const dstImmutables = srcEscrowEvent[0]
                .withComplement(srcEscrowEvent[1])
                .withTaker(new Address(resolverContract.dstAddress))

            console.log(`[${dstChainId}]`, `Depositing ${dstImmutables.amount} for order ${orderHash}`)
            const {txHash: dstDepositHash, blockTimestamp: dstDeployedAt} = await dstChainResolver.send(
                resolverContract.deployDst(dstImmutables)
            )
            console.log(`[${dstChainId}]`, `Created dst deposit for order ${orderHash} in tx ${dstDepositHash}`)

            const ESCROW_SRC_IMPLEMENTATION = await srcFactory.getSourceImpl()
            const ESCROW_DST_IMPLEMENTATION = await dstFactory.getDestinationImpl()

            const srcEscrowAddress = new Sdk.EscrowFactory(new Address(src.escrowFactory)).getSrcEscrowAddress(
                srcEscrowEvent[0],
                ESCROW_SRC_IMPLEMENTATION
            )

            const dstEscrowAddress = new Sdk.EscrowFactory(new Address(dst.escrowFactory)).getDstEscrowAddress(
                srcEscrowEvent[0],
                srcEscrowEvent[1],
                dstDeployedAt,
                new Address(resolverContract.dstAddress),
                ESCROW_DST_IMPLEMENTATION
            )

            await increaseTime(125)
            // user does not share secret, so cancel both escrows
            console.log(`[${dstChainId}]`, `Cancelling dst escrow ${dstEscrowAddress}`)
            await dstChainResolver.send(
                resolverContract.cancel('dst', dstEscrowAddress, dstImmutables.withDeployedAt(dstDeployedAt))
            )

            console.log(`[${srcChainId}]`, `Cancelling src escrow ${srcEscrowAddress}`)
            const {txHash: cancelSrcEscrow} = await srcChainResolver.send(
                resolverContract.cancel('src', srcEscrowAddress, srcEscrowEvent[0])
            )
            console.log(`[${srcChainId}]`, `Cancelled src escrow ${srcEscrowAddress} in tx ${cancelSrcEscrow}`)

            const resultBalances = await getBalances(
                config.chain.source.tokens.USDC.address,
                config.chain.destination.tokens.USDC.address
            )

            expect(initialBalances).toEqual(resultBalances)
        })
    })
})

async function initChain(
    cnf: ChainConfig
): Promise<{node?: CreateServerReturnType; provider: JsonRpcProvider; escrowFactory: string; resolver: string}> {
    const {node, provider} = await getProvider(cnf)
    const deployer = new SignerWallet(cnf.ownerPrivateKey, provider)

    // deploy EscrowFactory
    const escrowFactory = await deploy(
        factoryContract,
        [
            cnf.limitOrderProtocol,
            cnf.wrappedNative, // feeToken,
            Address.fromBigInt(0n).toString(), // accessToken,
            deployer.address, // owner
            60 * 30, // src rescue delay
            60 * 30 // dst rescue delay
        ],
        provider,
        deployer
    )
    console.log(`[${cnf.chainId}]`, `Escrow factory contract deployed to`, escrowFactory)

    // deploy Resolver contract
    const resolver = await deploy(
        resolverContract,
        [
            escrowFactory,
            cnf.limitOrderProtocol,
            computeAddress(resolverPk) // resolver as owner of contract
        ],
        provider,
        deployer
    )
    console.log(`[${cnf.chainId}]`, `Resolver contract deployed to`, resolver)

    return {node: node, provider, resolver, escrowFactory}
}

async function getProvider(cnf: ChainConfig): Promise<{node?: CreateServerReturnType; provider: JsonRpcProvider}> {
    if (!cnf.createFork) {
        return {
            provider: new JsonRpcProvider(cnf.url, cnf.chainId, {
                cacheTimeout: -1,
                staticNetwork: true
            })
        }
    }

    const node = createServer({
        instance: anvil({forkUrl: cnf.url, chainId: cnf.chainId}),
        limit: 1
    })
    await node.start()

    const address = node.address()
    assert(address)

    const provider = new JsonRpcProvider(`http://[${address.address}]:${address.port}/1`, cnf.chainId, {
        cacheTimeout: -1,
        staticNetwork: true
    })

    return {
        provider,
        node
    }
}

/**
 * Deploy contract and return its address
 */
async function deploy(
    json: {abi: any; bytecode: any},
    params: unknown[],
    provider: JsonRpcProvider,
    deployer: SignerWallet
): Promise<string> {
    const deployed = await new ContractFactory(json.abi, json.bytecode, deployer).deploy(...params)
    await deployed.waitForDeployment()

    return await deployed.getAddress()
}
