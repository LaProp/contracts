import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { WhiteList } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("WhiteList", () => {
    const deployFixture = async () => {
        const [owner, user1, user2, user3] = await ethers.getSigners();

        const WhiteList = await ethers.getContractFactory("WhiteList");
        const whitelist = await WhiteList.deploy();

        return {
            whitelist,
            owner,
            user1,
            user2,
            user3
        };
    };

    describe("Initialization", () => {
        it("Should initialize with correct roles for owner", async () => {
            const { whitelist, owner } = await loadFixture(deployFixture);

            // Check all roles are assigned to owner
            expect(await whitelist.hasRole(await whitelist.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
            expect(await whitelist.hasRole(await whitelist.MASTER_ROLE(), owner.address)).to.be.true;
            expect(await whitelist.hasRole(await whitelist.READER_ROLE(), owner.address)).to.be.true;
            expect(await whitelist.hasRole(await whitelist.WRITER_ROLE(), owner.address)).to.be.true;
        });

        it("Should initialize with empty whitelist", async () => {
            const { whitelist } = await loadFixture(deployFixture);
            expect(await whitelist.getWhiteListSize()).to.equal(0);
        });
    });

    describe("Role Management", () => {
        it("Should allow admin to grant roles", async () => {
            const { whitelist, owner, user1 } = await loadFixture(deployFixture);

            await whitelist.grantRole(await whitelist.READER_ROLE(), user1.address);
            expect(await whitelist.hasRole(await whitelist.READER_ROLE(), user1.address)).to.be.true;
        });

        it("Should allow admin to revoke roles", async () => {
            const { whitelist, owner, user1 } = await loadFixture(deployFixture);

            await whitelist.grantRole(await whitelist.READER_ROLE(), user1.address);
            await whitelist.revokeRole(await whitelist.READER_ROLE(), user1.address);
            expect(await whitelist.hasRole(await whitelist.READER_ROLE(), user1.address)).to.be.false;
        });

        it("Should not allow non-admin to grant roles", async () => {
            const { whitelist, user1, user2 } = await loadFixture(deployFixture);

            await expect(
                whitelist.connect(user1).grantRole(await whitelist.READER_ROLE(), user2.address)
            ).to.be.revertedWithCustomError(whitelist, "AccessControlUnauthorizedAccount")
             .withArgs(user1.address, await whitelist.DEFAULT_ADMIN_ROLE());
        });
    });

    describe("Address Management", () => {
        it("Should allow writer to add address", async () => {
            const { whitelist, user1 } = await loadFixture(deployFixture);

            await expect(whitelist.addAddress(user1.address))
                .to.emit(whitelist, "AddressAdded")
                .withArgs(user1.address);

            expect(await whitelist.getWhiteListSize()).to.equal(1);
        });

        it("Should not add duplicate address", async () => {
            const { whitelist, user1 } = await loadFixture(deployFixture);

            await whitelist.addAddress(user1.address);
            const tx = await whitelist.addAddress(user1.address);
            const receipt = await tx.wait();
            expect(receipt?.status).to.equal(1); // Transaction succeeded
            expect(await whitelist.getWhiteListSize()).to.equal(1);
        });

        it("Should allow writer to delete address", async () => {
            const { whitelist, user1 } = await loadFixture(deployFixture);

            await whitelist.addAddress(user1.address);
            await expect(whitelist.deleteAddress(user1.address))
                .to.emit(whitelist, "AddressDeleted")
                .withArgs(user1.address);

            expect(await whitelist.getWhiteListSize()).to.equal(0);
        });

        it("Should not allow non-writer to add address", async () => {
            const { whitelist, user1 } = await loadFixture(deployFixture);

            await expect(
                whitelist.connect(user1).addAddress(user1.address)
            ).to.be.revertedWithCustomError(whitelist, "AccessControlUnauthorizedAccount")
             .withArgs(user1.address, await whitelist.WRITER_ROLE());
        });

        it("Should not allow non-writer to delete address", async () => {
            const { whitelist, user1 } = await loadFixture(deployFixture);

            await whitelist.addAddress(user1.address);
            await expect(
                whitelist.connect(user1).deleteAddress(user1.address)
            ).to.be.revertedWithCustomError(whitelist, "AccessControlUnauthorizedAccount")
             .withArgs(user1.address, await whitelist.WRITER_ROLE());
        });
    });

    describe("Address Querying", () => {
        it("Should allow reader to check if address is whitelisted", async () => {
            const { whitelist, user1 } = await loadFixture(deployFixture);

            await whitelist.addAddress(user1.address);
            expect(await whitelist.isAddressWhiteListed(user1.address)).to.be.true;
        });

        it("Should not allow non-reader to check if address is whitelisted", async () => {
            const { whitelist, user1 } = await loadFixture(deployFixture);

            await whitelist.addAddress(user1.address);
            await expect(
                whitelist.connect(user1).isAddressWhiteListed(user1.address)
            ).to.be.revertedWithCustomError(whitelist, "AccessControlUnauthorizedAccount")
             .withArgs(user1.address, await whitelist.READER_ROLE());
        });

        it("Should return correct list of whitelisted addresses", async () => {
            const { whitelist, user1, user2 } = await loadFixture(deployFixture);

            await whitelist.addAddress(user1.address);
            await whitelist.addAddress(user2.address);

            const addresses = await whitelist.getAddressesInWhiteList();
            expect(addresses).to.have.lengthOf(2);
            expect(addresses).to.include(user1.address);
            expect(addresses).to.include(user2.address);
        });

        it("Should handle pagination correctly", async () => {
            const { whitelist, user1, user2, user3 } = await loadFixture(deployFixture);

            // Add multiple addresses
            await whitelist.addAddress(user1.address);
            await whitelist.addAddress(user2.address);
            await whitelist.addAddress(user3.address);

            // Test pagination with offset 1 and 2 items
            const paginatedAddresses = await whitelist.getAddressesInWhiteListPaginated(1, 2);
            expect(paginatedAddresses).to.have.lengthOf(2);
            expect(paginatedAddresses[0]).to.equal(user2.address);
            expect(paginatedAddresses[1]).to.equal(user3.address);
        });

        it("Should revert pagination with invalid parameters", async () => {
            const { whitelist, user1, user2 } = await loadFixture(deployFixture);

            await whitelist.addAddress(user1.address);
            await whitelist.addAddress(user2.address);

            // Try to get more items than available
            await expect(
                whitelist.getAddressesInWhiteListPaginated(0, 3)
            ).to.be.revertedWith("Offset + itemsAmount bigger than the array");

            // Try to get items with too large offset
            await expect(
                whitelist.getAddressesInWhiteListPaginated(2, 1)
            ).to.be.revertedWith("Offset + itemsAmount bigger than the array");
        });
    });

    describe("Complex Scenarios", () => {
        it("Should handle multiple operations in sequence", async () => {
            const { whitelist, user1, user2, user3 } = await loadFixture(deployFixture);

            // Add addresses
            await whitelist.addAddress(user1.address);
            await whitelist.addAddress(user2.address);
            expect(await whitelist.getWhiteListSize()).to.equal(2);

            // Delete one address
            await whitelist.deleteAddress(user1.address);
            expect(await whitelist.getWhiteListSize()).to.equal(1);

            // Add another address
            await whitelist.addAddress(user3.address);
            expect(await whitelist.getWhiteListSize()).to.equal(2);

            // Verify final state
            const addresses = await whitelist.getAddressesInWhiteList();
            expect(addresses).to.have.lengthOf(2);
            expect(addresses).to.include(user2.address);
            expect(addresses).to.include(user3.address);
            expect(addresses).to.not.include(user1.address);
        });

        it("Should maintain correct state after multiple role changes", async () => {
            const { whitelist, owner, user1, user2 } = await loadFixture(deployFixture);

            // Grant roles to user1
            await whitelist.grantRole(await whitelist.WRITER_ROLE(), user1.address);
            await whitelist.grantRole(await whitelist.READER_ROLE(), user1.address);

            // User1 adds an address
            await whitelist.connect(user1).addAddress(user2.address);
            expect(await whitelist.getWhiteListSize()).to.equal(1);

            // Revoke writer role from user1
            await whitelist.revokeRole(await whitelist.WRITER_ROLE(), user1.address);

            // User1 should still be able to read but not write
            expect(await whitelist.connect(user1).isAddressWhiteListed(user2.address)).to.be.true;
            await expect(
                whitelist.connect(user1).addAddress(owner.address)
            ).to.be.revertedWithCustomError(whitelist, "AccessControlUnauthorizedAccount")
             .withArgs(user1.address, await whitelist.WRITER_ROLE());
        });
    });
}); 