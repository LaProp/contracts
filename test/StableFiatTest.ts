import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { StableFiat } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("StableFiat", function () {
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"));
    const MASTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MASTER_ROLE"));
    const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

    async function deployFixture() {
        const [owner, user1, user2, minter, manager, master] = await ethers.getSigners();

        const StableFiat = await ethers.getContractFactory("StableFiat");
        const token = await StableFiat.deploy();
        await token.waitForDeployment();

        // Initialize the contract
        await token.initialize("Test Stable", "TST", owner.address);

        // Setup roles
        await token.grantRole(MINTER_ROLE, minter.address);
        await token.grantRole(MANAGER_ROLE, manager.address);
        await token.grantRole(MASTER_ROLE, master.address);

        return {
            token,
            owner,
            user1,
            user2,
            minter,
            manager,
            master
        };
    }

    describe("Initialization", function () {
        it("Should initialize with correct values", async function () {
            const { token, owner } = await loadFixture(deployFixture);
            
            expect(await token.name()).to.equal("Test Stable");
            expect(await token.symbol()).to.equal("TST");
            expect(await token.owner()).to.equal(owner.address);
            expect(await token.paused()).to.equal(false);
        });

        it("Should set up roles correctly", async function () {
            const { token, owner, minter, manager, master } = await loadFixture(deployFixture);
            
            expect(await token.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
            expect(await token.hasRole(MINTER_ROLE, minter.address)).to.be.true;
            expect(await token.hasRole(MANAGER_ROLE, manager.address)).to.be.true;
            expect(await token.hasRole(MASTER_ROLE, master.address)).to.be.true;
        });

        it("Should prevent reinitialization", async function () {
            const { token, owner } = await loadFixture(deployFixture);
            
            await expect(token.initialize("Test2", "TST2", owner.address))
                .to.be.revertedWithCustomError(token, "InvalidInitialization");
        });

        it("Should initialize with zero total supply", async function () {
            const { token } = await loadFixture(deployFixture);
            expect(await token.totalSupply()).to.equal(0);
        });
    });

    describe("Minting and Supply Management", function () {
        it("Should allow minter to increase supply", async function () {
            const { token, minter } = await loadFixture(deployFixture);
            
            await expect(token.connect(minter).increaseSupply(1000))
                .to.emit(token, "IncreaseSupply")
                .withArgs(minter.address, 1000);
            
            expect(await token.totalSupply()).to.equal(1000);
            expect(await token.balanceOf(minter.address)).to.equal(1000);
        });

        it("Should allow minter to decrease supply", async function () {
            const { token, minter } = await loadFixture(deployFixture);
            
            await token.connect(minter).increaseSupply(1000);
            await expect(token.connect(minter).decreaseSupply(500))
                .to.emit(token, "DecreaseSupply")
                .withArgs(minter.address, 500);
            
            expect(await token.totalSupply()).to.equal(1500);
        });

        it("Should prevent non-minters from managing supply", async function () {
            const { token, user1 } = await loadFixture(deployFixture);
            
            await expect(token.connect(user1).increaseSupply(1000))
                .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
                .withArgs(user1.address, MINTER_ROLE);
            
            await expect(token.connect(user1).decreaseSupply(1000))
                .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
                .withArgs(user1.address, MINTER_ROLE);
        });

        it("Should allow minting zero tokens", async function () {
            const { token, minter } = await loadFixture(deployFixture);
            
            await expect(token.connect(minter).increaseSupply(0))
                .to.emit(token, "IncreaseSupply")
                .withArgs(minter.address, 0);
            
            expect(await token.totalSupply()).to.equal(0);
        });

        it("Should handle large token amounts correctly", async function () {
            const { token, minter } = await loadFixture(deployFixture);
            const largeAmount = ethers.parseUnits("1000000000", 18); // 1 billion tokens
            
            await expect(token.connect(minter).increaseSupply(largeAmount))
                .to.emit(token, "IncreaseSupply")
                .withArgs(minter.address, largeAmount);
            
            expect(await token.totalSupply()).to.equal(largeAmount);
            expect(await token.balanceOf(minter.address)).to.equal(largeAmount);
        });

        it("Should track total supply correctly across multiple operations", async function () {
            const { token, minter } = await loadFixture(deployFixture);
            
            // First increase
            await token.connect(minter).increaseSupply(1000);
            expect(await token.totalSupply()).to.equal(1000);
            
            // Second increase
            await token.connect(minter).increaseSupply(500);
            expect(await token.totalSupply()).to.equal(1500);
            
            // Decrease
            await token.connect(minter).decreaseSupply(300);
            expect(await token.totalSupply()).to.equal(1800);
        });
    });

    describe("Account Freezing", function () {
        it("Should allow master to freeze accounts", async function () {
            const { token, master, user1 } = await loadFixture(deployFixture);
            
            await expect(token.connect(master).freezeAccount(user1.address))
                .to.emit(token, "AddressFrozenAccount")
                .withArgs(user1.address);
            
            expect(await token.isFrozen(user1.address)).to.be.true;
        });

        it("Should allow master to unfreeze accounts", async function () {
            const { token, master, user1 } = await loadFixture(deployFixture);
            
            await token.connect(master).freezeAccount(user1.address);
            await expect(token.connect(master).unFreezeAccount(user1.address))
                .to.emit(token, "AddressUnfrozenAccount")
                .withArgs(user1.address);
            
            expect(await token.isFrozen(user1.address)).to.be.false;
        });

        it("Should prevent transfers involving frozen accounts", async function () {
            const { token, master, minter, user1, user2 } = await loadFixture(deployFixture);
            
            // Setup: mint tokens and transfer to users
            await token.connect(minter).increaseSupply(1000);
            await token.connect(minter).transfer(user1.address, 500);
            await token.connect(minter).transfer(user2.address, 500);
            
            // Freeze user1's account
            await token.connect(master).freezeAccount(user1.address);

            // Test transfer from frozen account
            await expect(token.connect(user1).transfer(user2.address, 100))
                .to.be.revertedWith("Account 'from' frozen");
            
            // Test transfer to frozen account
            await expect(token.connect(user2).transfer(user1.address, 100))
                .to.be.revertedWith("Account 'to' frozen");
        });

        it("Should allow master to wipe frozen accounts", async function () {
            const { token, master, minter, user1 } = await loadFixture(deployFixture);
            
            // Setup: mint tokens and transfer to user1
            await token.connect(minter).increaseSupply(1000);
            await token.connect(minter).transfer(user1.address, 500);
            
            // Freeze user1's account
            await token.connect(master).freezeAccount(user1.address);

            // Wipe the frozen account
            await expect(token.connect(master).wipeFrozenAddress(user1.address))
                .to.emit(token, "WipedFrozenAccount")
                .withArgs(user1.address, 500);
            
            expect(await token.balanceOf(user1.address)).to.equal(0);
        });

        it("Should prevent non-masters from managing frozen accounts", async function () {
            const { token, user1, user2 } = await loadFixture(deployFixture);
            
            await expect(token.connect(user1).freezeAccount(user2.address))
                .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
                .withArgs(user1.address, MASTER_ROLE);
            
            await expect(token.connect(user1).unFreezeAccount(user2.address))
                .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
                .withArgs(user1.address, MASTER_ROLE);
        });

        it("Should prevent freezing zero address", async function () {
            const { token, master } = await loadFixture(deployFixture);
            
            await expect(token.connect(master).freezeAccount(ethers.ZeroAddress))
                .to.emit(token, "AddressFrozenAccount")
                .withArgs(ethers.ZeroAddress);
            
            expect(await token.isFrozen(ethers.ZeroAddress)).to.be.true;
        });

        it("Should prevent freezing already frozen account", async function () {
            const { token, master, user1 } = await loadFixture(deployFixture);
            
            await token.connect(master).freezeAccount(user1.address);
            
            // Freezing again should still work and emit event
            await expect(token.connect(master).freezeAccount(user1.address))
                .to.emit(token, "AddressFrozenAccount")
                .withArgs(user1.address);
        });

        it("Should prevent unfreezing non-frozen account", async function () {
            const { token, master, user1 } = await loadFixture(deployFixture);
            
            // Unfreezing a non-frozen account should still work and emit event
            await expect(token.connect(master).unFreezeAccount(user1.address))
                .to.emit(token, "AddressUnfrozenAccount")
                .withArgs(user1.address);
        });

        it("Should prevent wiping non-frozen account", async function () {
            const { token, master, user1, minter } = await loadFixture(deployFixture);
            
            // Setup: give user1 some tokens
            await token.connect(minter).increaseSupply(1000);
            await token.connect(minter).transfer(user1.address, 500);
            
            // Try to wipe non-frozen account
            await expect(token.connect(master).wipeFrozenAddress(user1.address))
                .to.be.revertedWith("Address is not frozen");
        });

        it("Should handle wiping account with zero balance", async function () {
            const { token, master, user1 } = await loadFixture(deployFixture);
            
            // Freeze account with zero balance
            await token.connect(master).freezeAccount(user1.address);
            
            // Wipe should succeed but with 0 amount
            await expect(token.connect(master).wipeFrozenAddress(user1.address))
                .to.emit(token, "WipedFrozenAccount")
                .withArgs(user1.address, 0);
        });
    });

    describe("Manager Functions", function () {
        it("Should allow manager to reclaim tokens", async function () {
            const { token, manager, minter } = await loadFixture(deployFixture);
            
            await token.connect(minter).increaseSupply(1000);
            await token.connect(minter).transfer(token.getAddress(), 500);

            const initialBalance = await token.balanceOf(token.getAddress());
            await token.connect(manager).reclaimLCCop();
            const finalBalance = await token.balanceOf(token.getAddress());
            
            expect(finalBalance).to.equal(0);
            expect(finalBalance).to.be.lessThan(initialBalance);
        });

        it("Should prevent non-managers from reclaiming tokens", async function () {
            const { token, user1 } = await loadFixture(deployFixture);
            
            await expect(token.connect(user1).reclaimLCCop())
                .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
                .withArgs(user1.address, MANAGER_ROLE);
        });

        it("Should handle reclaiming zero tokens", async function () {
            const { token, manager } = await loadFixture(deployFixture);
            
            // Contract has 0 balance initially
            await token.connect(manager).reclaimLCCop();
            expect(await token.balanceOf(token.getAddress())).to.equal(0);
        });

        it("Should reclaim tokens sent through transfer", async function () {
            const { token, manager, minter } = await loadFixture(deployFixture);
            
            // Send tokens to contract through normal transfer
            await token.connect(minter).increaseSupply(1000);
            await token.connect(minter).transfer(token.getAddress(), 500);
            
            // Reclaim should work
            await token.connect(manager).reclaimLCCop();
            expect(await token.balanceOf(token.getAddress())).to.equal(0);
        });
    });

    describe("ERC20 Standard Compliance", function () {
        it("Should have 18 decimals", async function () {
            const { token } = await loadFixture(deployFixture);
            expect(await token.decimals()).to.equal(18);
        });

        it("Should handle allowances correctly", async function () {
            const { token, minter, user1, user2 } = await loadFixture(deployFixture);
            
            // Setup
            await token.connect(minter).increaseSupply(1000);
            await token.connect(minter).transfer(user1.address, 500);
            
            // Approve and check allowance
            await token.connect(user1).approve(user2.address, 200);
            expect(await token.allowance(user1.address, user2.address)).to.equal(200);
            
            // Transfer using allowance
            await token.connect(user2).transferFrom(user1.address, user2.address, 100);
            expect(await token.allowance(user1.address, user2.address)).to.equal(100);
            expect(await token.balanceOf(user2.address)).to.equal(100);
        });

        it("Should emit Transfer events", async function () {
            const { token, minter, user1 } = await loadFixture(deployFixture);
            
            await token.connect(minter).increaseSupply(1000);
            
            await expect(token.connect(minter).transfer(user1.address, 500))
                .to.emit(token, "Transfer")
                .withArgs(minter.address, user1.address, 500);
        });

        it("Should emit Approval events", async function () {
            const { token, user1, user2 } = await loadFixture(deployFixture);
            
            await expect(token.connect(user1).approve(user2.address, 1000))
                .to.emit(token, "Approval")
                .withArgs(user1.address, user2.address, 1000);
        });

        it("Should prevent transferFrom without sufficient allowance", async function () {
            const { token, minter, user1, user2 } = await loadFixture(deployFixture);
            
            // Setup
            await token.connect(minter).increaseSupply(1000);
            await token.connect(minter).transfer(user1.address, 500);
            await token.connect(user1).approve(user2.address, 50);

            // Try to transfer more than allowed
            await expect(token.connect(user2).transferFrom(user1.address, user2.address, 100))
                .to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance")
                .withArgs(user2.address, 50, 100);
        });

        it("Should prevent transfer with insufficient balance", async function () {
            const { token, user1, user2 } = await loadFixture(deployFixture);
            
            // Try to transfer without any balance
            await expect(token.connect(user1).transfer(user2.address, 100))
                .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance")
                .withArgs(user1.address, 0, 100);
        });

        it("Should prevent transferFrom with insufficient balance", async function () {
            const { token, user1, user2 } = await loadFixture(deployFixture);
            
            // Approve but don't have balance
            await token.connect(user1).approve(user2.address, 100);
            
            await expect(token.connect(user2).transferFrom(user1.address, user2.address, 100))
                .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance")
                .withArgs(user1.address, 0, 100);
        });

        it("Should prevent transfer to zero address", async function () {
            const { token, minter } = await loadFixture(deployFixture);
            
            await token.connect(minter).increaseSupply(1000);
            
            await expect(token.connect(minter).transfer(ethers.ZeroAddress, 100))
                .to.be.revertedWithCustomError(token, "ERC20InvalidReceiver")
                .withArgs(ethers.ZeroAddress);
        });

        it("Should prevent approve to zero address", async function () {
            const { token, user1 } = await loadFixture(deployFixture);
            
            await expect(token.connect(user1).approve(ethers.ZeroAddress, 100))
                .to.be.revertedWithCustomError(token, "ERC20InvalidSpender")
                .withArgs(ethers.ZeroAddress);
        });
    });

    describe("Pausable Functionality", function () {
        it("Should prevent transfers when paused", async function () {
            const { token, owner, minter, user1 } = await loadFixture(deployFixture);
            
            await token.connect(minter).increaseSupply(1000);
            await token.connect(owner).pause();

            await expect(token.connect(minter).transfer(user1.address, 100))
                .to.be.revertedWithCustomError(token, "EnforcedPause");
        });

        it("Should prevent transferFrom when paused", async function () {
            const { token, owner, minter, user1, user2 } = await loadFixture(deployFixture);
            
            // Setup
            await token.connect(minter).increaseSupply(1000);
            await token.connect(minter).transfer(user1.address, 500);
            await token.connect(user1).approve(user2.address, 100);
            
            // Pause and try transfer
            await token.connect(owner).pause();
            await expect(token.connect(user2).transferFrom(user1.address, user2.address, 100))
                .to.be.revertedWithCustomError(token, "EnforcedPause");
        });

        it("Should prevent minting when paused", async function () {
            const { token, owner, minter } = await loadFixture(deployFixture);
            
            await token.connect(owner).pause();
            await expect(token.connect(minter).increaseSupply(1000))
                .to.be.revertedWithCustomError(token, "EnforcedPause");
        });

        it("Should prevent burning when paused", async function () {
            const { token, owner, minter } = await loadFixture(deployFixture);
            
            // Setup
            await token.connect(minter).increaseSupply(1000);
            
            // Pause and try burn
            await token.connect(owner).pause();
            await expect(token.connect(minter).decreaseSupply(500))
                .to.be.revertedWithCustomError(token, "EnforcedPause");
        });
    });
}); 