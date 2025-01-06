# Smart Contract Suite for Digital Asset Management

## About LaProp

LaProp is a proptech and fintech service provider for real estate companies. We help real estate companies to be more efficient and create new business models in the world of Real World Assets (RWAs). Our mission is to drive innovation and efficiency in the real estate sector through cutting-edge technology solutions. We are proud to have received a grant from the Lisk ecosystem, which supports our commitment to developing and open-sourcing technology that contributes to the growth and development of the Lisk blockchain.

This repository contains a suite of smart contracts designed for managing digital assets, including stablecoins and Real Estate Investment Tokens (REIT), with robust security features and compliance mechanisms. We are proud to announce that this suite is built on the Lisk blockchain, and we are committed to open-sourcing our technology to contribute to the development of the Lisk ecosystem.

## About Lisk

Lisk is a Layer 2 (L2) blockchain platform built on the Optimism (OP) Stack, designed to provide scalable and cost-efficient blockchain infrastructure. Originally a Layer 1 (L1) blockchain, Lisk transitioned to a Layer 2 model to leverage Ethereum's security and enhance its capabilities. By utilizing the OP Stack, Lisk offers a highly efficient, fast, and easily scalable network secured by Ethereum. This integration ensures that developers experience a familiar Ethereum development environment with extremely low fees, making it an attractive option for building decentralized applications (dApps).

Lisk's mission is to make blockchain technology accessible to a wider audience, particularly in high-growth markets such as Africa and Southeast Asia. To achieve this, Lisk provides a comprehensive Software Development Kit (SDK) based on JavaScript, the world's most widely-used programming language. This approach lowers the barrier for developers entering the blockchain space, enabling them to leverage familiar tools for blockchain app development.

In addition to its technical infrastructure, Lisk offers hands-on support for founders and developers through various programs, including grants and incubation initiatives. These programs are designed to provide financial support, guidance, and mentorship at every step, covering essentials like customer acquisition, tokenomics, fundraising, business model optimization, and community growth.

Lisk is also part of the Superchain ecosystem, which focuses on interoperability and seamless asset transfers across major blockchain networks. As an optimistic rollup on Ethereum built with the OP Stack, Lisk inherits the security guarantees from Ethereum, providing developers and users with a secure and efficient platform for their applications.

## Key Components

### StableFiat Token
An upgradeable ERC20 token implementation with the following features:
- **Pausable functionality** for emergency situations
- **Role-based access control** (MINTER, MANAGER, MASTER roles)
- **Account freezing capabilities**
- **Supply management functions**
- **EIP-3009 support** for gasless transfers

### REIT Token
An ERC20 token specifically designed for Real Estate Investment Tokens with:
- **Whitelisting functionality** for regulatory compliance
- **Role-based access control**
- **Pausable operations**
- **EIP-3009 support**
- **Meta-transaction capabilities** (EIP-2771)

### WhiteList
A flexible whitelisting system featuring:
- **Role-based access control** (MASTER, READER, WRITER roles)
- **Address management functionality**
- **Event emission** for tracking changes
- **Enumerable address set implementation**

## Technical Stack

- **Solidity version**: ^0.8.20
- **Framework**: Hardhat
- **Key Dependencies**:
  - OpenZeppelin Contracts v5.1.0
  - OpenZeppelin Contracts Upgradeable v5.1.0
  - Hardhat Toolbox

## Security Features

- **Role-based access control** for all critical functions
- **Pausable functionality** for emergency situations
- **Upgradeable contract patterns**
- **EIP-712 domain separation**
- **Whitelist integration** for compliance
- **Account freezing capabilities**

## Development Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Compile contracts**:
   ```bash
   npx hardhat compile
   ```

3. **Run tests**:
   ```bash
   npx hardhat test
   ```

## Contract Deployment

Contracts should be deployed in the following order:
1. **WhiteList contract**
2. **StableFiat contract** (via proxy)
3. **REIT token** (with WhiteList address)

## Security Considerations

- All critical functions are protected by **role-based access control**
- Contracts follow the **checks-effects-interactions pattern**
- **Upgradeable contracts** are used where future modifications might be needed
- **EIP-712** is implemented for secure message signing
- **Whitelist functionality** can be activated/deactivated for REIT tokens

## Disclaimer

Please note that these contracts have not been audited. We are not responsible for any damage or loss caused by the use of these contracts. Use them at your own risk.

## License

MIT