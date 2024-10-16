const { JsonRpcProvider, Wallet, ethers } = require("ethers");
const { FlashbotsBundleProvider, FlashbotsBundleResolution } = require("@flashbots/ethers-provider-bundle") 
const { exit } = require('process');

// sepolia
const FLASHBOTS_ENDPOINT = 'https://relay-sepolia.flashbots.net' 
const CHAIN_ID = 11155111;
const recipientAddress = "0xE076A837c47748A1fC693bC991161e590B02CD7d"; // Address where you want to send ERC20 tokens
const tokenAddress = "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0"; // Address of the ERC20 token contract
const amount = ethers.parseUnits('', ); 

const provider = new ethers.JsonRpcProvider("https://rpc.sepolia.org");

const authSigner = ''; //optional

// Account sponsoring the gas fee
// compromised account
const sponsor_wallet = new ethers.Wallet(process.env.SPONSOR_KEY).connect(provider);
const compromised_wallet = new ethers.Wallet(process.env.COMPROMISED_KEY).connect(provider);


let i = 0;
const main = async () => {
    // bundle transactions
    const transactionBundle = [
        {   // send the compromised wallet some eth
            transaction: {
                chainId: CHAIN_ID,
                value: ethers.parseEther(""),
                type: 2, 
                to: compromised_wallet.address,
                maxFeePerGas: ethers.parseUnits("", "gwei"),
                maxPriorityFeePerGas: ethers.parseUnits("", "gwei"),
                gasLimit: 0,
            }, 
            signer: sponsor_wallet, // ethers signer
        },

        {   // Transfer Token
            transaction: {
                chainId: CHAIN_ID,
                value: 0,
                type: 2, 
                to: tokenAddress, 
                maxFeePerGas: ethers.parseUnits("", "gwei"),
                maxPriorityFeePerGas: ethers.parseUnits("", "gwei"),
                gasLimit: 0,
                data: transactionData,
            },
            signer: compromised_wallet, 
        }
    ]

    console.log("Preparing...");

    const flashbotsProvider = await FlashbotsBundleProvider.create(provider, authSigner, FLASHBOTS_ENDPOINT, 'sepolia')

    provider.on("block", async (blockNumber) => {
        console.log(`Current Block: ${blockNumber}`);

        const targetBlockNumber = blockNumber + 3 ;
        console.log(`Preparing bundle for next block: ${targetBlockNumber}`);

        const signedBundle = await flashbotsProvider.signBundle(transactionBundle);
        const simulation = await flashbotsProvider.simulate(signedBundle, targetBlockNumber)
        if ("error" in simulation) {
            console.error(`Simulation error: ${simulation.error.message}`);
            return;
        }
        console.log("Simulation successful.");

        const flashbotsTransactionResponse = await flashbotsProvider.sendRawBundle(
            signedBundle,
            targetBlockNumber
        );
        if ("error" in flashbotsTransactionResponse) {
            console.error(`Error: ${flashbotsTransactionResponse.error.message}`);
            return;
        }

        console.log(`Bundle sent, waiting for inclusion in block ${targetBlockNumber}`);

        const waitResponse = await flashbotsTransactionResponse.wait();

        if (waitResponse === FlashbotsBundleResolution.BundleIncluded) {
            console.log(`Success: Bundle included in block ${targetBlockNumber}`, waitResponse);
            exit(0);
        } else if (waitResponse === FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
            console.log(`Warning: Bundle not included in block ${targetBlockNumber}`, waitResponse);
        } else if (waitResponse === FlashbotsBundleResolution.AccountNonceTooHigh) {
            console.error("Error: Nonce too high, exiting", waitResponse);
            exit(1);
        } else {
            console.error(`Unexpected waitResponse: ${waitResponse}`, waitResponse);
        }
        i++;
    });
}
main();
