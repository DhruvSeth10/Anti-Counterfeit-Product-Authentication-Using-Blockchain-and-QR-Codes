// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ProductAuth
 * @notice Prototype for "Anti-Counterfeit Product Authentication Using Blockchain and QR Codes".
 *
 * Objective 1 - On-chain identity & QR linkage : registerProduct() -> unique productId (encoded in the QR).
 * Objective 2 - Ownership transfer & reuse detect: transferProduct(), scanProduct(), verifyProduct().
 * Objective 3 - Role-based access control        : OpenZeppelin AccessControl (4 roles).
 */
contract ProductAuth is AccessControl {
    // ---------- Objective 3: roles ----------
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE  = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant RETAILER_ROLE     = keccak256("RETAILER_ROLE");
    bytes32 public constant CONSUMER_ROLE     = keccak256("CONSUMER_ROLE");

    enum Stage   { Manufactured, AtDistributor, AtRetailer, SoldToConsumer }
    enum Verdict { NotRegistered, Genuine, AlreadyClaimed }

    struct Product {
        address manufacturer;
        address owner;
        Stage   stage;
        bool    exists;
        bool    flagged;      // set when a reuse / cloned QR is detected
        uint32  scanCount;
        uint64  registeredAt;
        string  name;
        string  batch;
    }

    struct Custody { address from; address to; Stage stage; uint64 at; }

    mapping(bytes32 => Product)   private products;
    mapping(bytes32 => Custody[]) private history;

    event ProductRegistered(bytes32 indexed id, address indexed manufacturer, string name);
    event ProductTransferred(bytes32 indexed id, address indexed from, address indexed to, Stage stage);
    event ProductScanned(bytes32 indexed id, address indexed scanner, Verdict verdict);
    event ReuseDetected(bytes32 indexed id, address indexed scanner);

    error AlreadyRegistered();
    error NotRegisteredProduct();
    error NotCurrentOwner();
    error AlreadySold();
    error RecipientHasWrongRole();

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// Consumers need no approval - anyone can self-enrol as a buyer.
    function joinAsConsumer() external {
        _grantRole(CONSUMER_ROLE, msg.sender);
    }

    // ---------- Objective 1: identity & QR linkage ----------
    /// @return id the unique on-chain identifier; encode this (with contract address) in the QR code.
    function registerProduct(string calldata name, string calldata batch, string calldata serial)
        external onlyRole(MANUFACTURER_ROLE) returns (bytes32 id)
    {
        id = keccak256(abi.encode(msg.sender, serial));
        if (products[id].exists) revert AlreadyRegistered();

        products[id] = Product(msg.sender, msg.sender, Stage.Manufactured, true, false, 0,
                               uint64(block.timestamp), name, batch);
        history[id].push(Custody(address(0), msg.sender, Stage.Manufactured, uint64(block.timestamp)));
        emit ProductRegistered(id, msg.sender, name);
    }

    // ---------- Objective 2: ownership transfer ----------
    /// Moves custody one step along Manufacturer -> Distributor -> Retailer -> Consumer.
    function transferProduct(bytes32 id, address to) external {
        Product storage p = products[id];
        if (!p.exists) revert NotRegisteredProduct();
        if (p.owner != msg.sender) revert NotCurrentOwner();
        if (p.stage == Stage.SoldToConsumer) revert AlreadySold();

        if (p.stage == Stage.Manufactured && !hasRole(DISTRIBUTOR_ROLE, to)) revert RecipientHasWrongRole();
        if (p.stage == Stage.AtDistributor && !hasRole(RETAILER_ROLE, to))   revert RecipientHasWrongRole();
        if (p.stage == Stage.AtRetailer    && !hasRole(CONSUMER_ROLE, to))   revert RecipientHasWrongRole();

        p.stage = Stage(uint8(p.stage) + 1);
        history[id].push(Custody(p.owner, to, p.stage, uint64(block.timestamp)));
        emit ProductTransferred(id, p.owner, to, p.stage);
        p.owner = to;
    }

    // ---------- Objective 2: reuse detection ----------
    /// Free, read-only check used by the consumer UI.
    function verifyProduct(bytes32 id) public view returns (Verdict) {
        Product storage p = products[id];
        if (!p.exists) return Verdict.NotRegistered;
        if (p.stage == Stage.SoldToConsumer) return Verdict.AlreadyClaimed;
        return Verdict.Genuine;
    }

    /// On-chain scan: records the scan and permanently flags a code that is presented
    /// on a unit already sold to a *different* consumer (i.e. a cloned QR).
    function scanProduct(bytes32 id) external returns (Verdict v) {
        v = verifyProduct(id);
        Product storage p = products[id];
        if (p.exists) {
            p.scanCount++;
            if (v == Verdict.AlreadyClaimed) {
                if (p.owner == msg.sender) {
                    v = Verdict.Genuine;               // the rightful owner re-checking their item
                } else {
                    p.flagged = true;
                    emit ReuseDetected(id, msg.sender);
                }
            }
        }
        emit ProductScanned(id, msg.sender, v);
    }

    // ---------- Views ----------
    function getProduct(bytes32 id) external view returns (Product memory) {
        if (!products[id].exists) revert NotRegisteredProduct();
        return products[id];
    }

    function getHistory(bytes32 id) external view returns (Custody[] memory) {
        return history[id];
    }
}
