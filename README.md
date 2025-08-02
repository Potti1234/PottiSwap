# PottiSwap

This is an implementation of a Crosschainswap from EVM to Algorand

It is based on the 1Inch smart contracts and the 1Inch crosschain sdk

# AlgoRand Contracts

Since algorand has different functionalities compared to the EVM I had to change different parts of the structure of the crosschain swap

-No Intents:
There is no equivalient to the token.approve functionality thats why I change the intent logic so a User has the put his funds directly in escrow

-No EscrowFactory:
Since it is not possible to deploy a smart contract and the interact with it in the same call I needed to make a decision use a EscrowFactory but 2 calls from the user or a direct call to a escrow contract that handles all escrows. I chose the second option to only have 1 transaction for the user so better usability and less fees

The rest of the contracts behave similar to the 1Inch EVM equivalents the flow from EVM to Algorand is the same for the userer as EVM to EVM for the Algorand to EVM flow this is the flow:

-Maker generates secret
-Maker deposits his escrow funds in the Escrow contract
-Relayer starts an Dutch Auction based on the created escrow. My Implementation of the Dutch auction is a linear dutch auction
-Whitelisted Resolver bids on the Auction
-Winning resoilver creates Escrow based on the price of the auction
-Relayer validates both escrows and notifies user to share the secret
-User shares secret with Relayer
-Relayer shares secret with Resolvers
-Resolvers execute withdraw transactions on both chains

Main Usability changes:
User pays gas: No problem because gas fees on Algorand are minimal aproximately 0.001 Algo for a call 1 Algo = 0.19€
