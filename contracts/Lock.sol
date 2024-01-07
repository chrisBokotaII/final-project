// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
// import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC721, ERC721Enumerable, ERC721URIStorage, ERC721Burnable, Ownable {
    constructor(address initialOwner)
        ERC721("MyToken", "MTK")
        Ownable(initialOwner)
    {}

    function safeMint(address to, uint256 tokenId, string memory uri)
        public
        onlyOwner 
    {
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }
    // function pause() external onlyOwner {
    //     _pause();
    // }
    // function unpause() public onlyOwner {
    //     _unpause();
    // }
     

    // The following functions are overrides required by Solidity.

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    
}
contract Auction is ReentrancyGuard {
    struct AuctionInfo {
        address seller;
        uint256 tokenId;
        uint256 highestBid;
        address payable highestBidder;
        uint256 endTimestamp;
        bool ended;
    }

    mapping(uint256 => AuctionInfo) public auctions;
    mapping(uint256 => bool) public claimedNFT;

    event NewBid(address indexed bidder, uint256 indexed tokenId, uint256 amount);
    event AuctionEnded(uint256 indexed tokenId, address indexed winner, uint256 amount);
    event Claimed(address indexed bidder, uint256 indexed tokenID);
    event moneySent(address indexed seller , uint256 indexed tokenID, uint256 amount);

    modifier auctionExists(uint256 tokenId) {
        require(auctions[tokenId].seller != address(0), "Auction does not exist");
        _;
    }

    modifier onlySeller(uint256 tokenId) {
        require(auctions[tokenId].seller == msg.sender, "Not the auction seller");
        _;
    }

    constructor() {
     
    }
    // this function return the sellers address
    function getSeller(uint256 auctionId) external view returns (address) {
        return auctions[auctionId].seller;
    }
    // this function return the highest bidder address
    function getHighestBidder(uint256 auctionId) external view returns (address) {
        return auctions[auctionId].highestBidder;
    }
    function isEnded(uint256 auctionId) external view returns (bool) {
        return auctions[auctionId].ended;
    }
// this function start the auction
    function startAuction(
        address tokenContract,
        uint256 tokenId,
        uint256 duration
    ) external nonReentrant {
        MyToken nft = MyToken(tokenContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not token owner");
        require(duration > 0, "Duration should be > 0");

        nft.transferFrom(msg.sender, address(this), tokenId);

        auctions[tokenId] = AuctionInfo({
            seller: msg.sender,
            tokenId: tokenId,
            highestBid: 0,
            highestBidder: payable(address(0)),
            endTimestamp: block.timestamp + duration,
            ended: false
        });
    }
    // this function post a bid and replace the highest bid if the new bid is higher than the highest bid

    function bid(uint256 tokenId) external payable nonReentrant auctionExists(tokenId) {
        AuctionInfo storage auction = auctions[tokenId];
        require(block.timestamp < auction.endTimestamp, "Auction ended");
        require(msg.value > auction.highestBid, "Bid too low");

        if (auction.highestBidder != address(0)) {
            auction.highestBidder.transfer(auction.highestBid);
        }

        auction.highestBid = msg.value;
        auction.highestBidder = payable(msg.sender);
        emit NewBid(msg.sender, tokenId, msg.value);
    }
    // this function ends the auction

    function endAuction(uint256 tokenId) external nonReentrant auctionExists(tokenId) {
        AuctionInfo storage auction = auctions[tokenId];
        require(block.timestamp >= auction.endTimestamp, "Auction not ended");
        require(!auction.ended, "Auction already ended");
        auction.ended = true;

        emit AuctionEnded(tokenId, auction.highestBidder, auction.highestBid);
    }
    // this function claims the NFT and thransfer the nft to the winner and transfer the money to the seller
    function claimNFT(uint256 tokenId,address tokenContract) external nonReentrant auctionExists(tokenId) {
         AuctionInfo storage auction = auctions[tokenId];

        require(auction.ended, "Auction not ended");

        require(auction.highestBidder == msg.sender,"not the winner");

        MyToken nft = MyToken(tokenContract);

        if(!claimedNFT[tokenId]){

          nft.transferFrom(address(this), msg.sender, tokenId);

        claimedNFT[tokenId] = true; 

         payable(auction.seller).transfer(auction.highestBid); 

         emit Claimed(msg.sender, tokenId);

         emit moneySent(auction.seller, tokenId, auction.highestBid);

        }else{
            revert("already claimed");
        }
        
    }
// this function withdraw the NFT if no winner or the bid from the winner
    function withdraw(uint256 tokenId,address tokenContract) external nonReentrant auctionExists(tokenId) {

        AuctionInfo storage auction = auctions[tokenId];

        require(auction.ended, "Auction not ended");

        if (msg.sender == auction.seller) {

            require(auction.highestBidder == address(0), "Cannot withdraw, auction ended");

            MyToken nft = MyToken(tokenContract);

            // tranfer the nft back to the seller
            nft.transferFrom(address(this), auction.seller, tokenId);

        } else if (msg.sender == auction.highestBidder) {

        require(!claimedNFT[tokenId], "Bidder already received NFT");

         payable(msg.sender).transfer(auction.highestBid);

        } else {
            revert("Not allowed to withdraw");
        }
    }

}
