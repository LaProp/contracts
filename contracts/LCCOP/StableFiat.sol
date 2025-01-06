// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../EIP3009/EIP3009Upgradable.sol";

contract StableFiat is ERC20PausableUpgradeable,EIP3009Upgradable, AccessControlUpgradeable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant MASTER_ROLE = keccak256("MASTER_ROLE");
    mapping(address => bool) private _frozenAccounts;
    address private _owner;

    event AddressFrozenAccount(address indexed account);
    event AddressUnfrozenAccount(address indexed account);
    event IncreaseSupply(address indexed account, uint amount);
    event DecreaseSupply(address indexed account, uint amount);
    event WipedFrozenAccount(address indexed accout, uint amout);

    function initialize(
        string memory name_,
        string memory symbol_,
        address owner_
    ) public initializer {
        __ERC20_init(name_, symbol_);
        __ERC20Pausable_init();
        _owner = owner_;
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(MANAGER_ROLE, _msgSender());
        _grantRole(MASTER_ROLE, _msgSender());
        DOMAIN_SEPARATOR = EIP712.makeDomainSeparator(name_, "1");
    }

    function owner() external view returns(address) {
        return _owner;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function reclaimLCCop() external onlyRole(MANAGER_ROLE) {
        uint256 _balance = super.balanceOf(address(this));
        _burn(address(this), _balance);
    }

    function freezeAccount(address account) external onlyRole(MASTER_ROLE) {
        _frozenAccounts[account] = true;
        emit AddressFrozenAccount(account);
    }

    function unFreezeAccount(address account) external onlyRole(MASTER_ROLE) {
        _frozenAccounts[account] = false;
        emit AddressUnfrozenAccount(account);
    }

    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20PausableUpgradeable, ERC20Upgradeable) {
        super._update(from, to, amount);

        // Allow burning of frozen accounts (when to is address(0))
        if (to != address(0)) {
            require(!_frozenAccounts[to], "Account 'to' frozen");
        }
        if (from != address(0)) {
            require(!_frozenAccounts[from] || hasRole(MASTER_ROLE, _msgSender()), "Account 'from' frozen");
        }
    }

    function isFrozen(address account) external view returns (bool) {
        return _frozenAccounts[account];
    }

    function increaseSupply(uint amount) external onlyRole(MINTER_ROLE) {
        _mint(_msgSender(), amount);
        emit IncreaseSupply(_msgSender(), amount);
    }

    function decreaseSupply(uint amount) external onlyRole(MINTER_ROLE) {
        _mint(_msgSender(), amount);
        emit DecreaseSupply(_msgSender(), amount);
    }

    function wipeFrozenAddress(address account) external onlyRole(MASTER_ROLE) {
        require(_frozenAccounts[account], "Address is not frozen");
        uint balance = super.balanceOf(account);
        _burn(account, balance);
        emit WipedFrozenAccount(account, balance);
    }
}