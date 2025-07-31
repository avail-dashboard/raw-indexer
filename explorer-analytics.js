// Analytics Engine for Avail DA Explorer
// Calculates network statistics, performance metrics, and data availability analytics

class ExplorerAnalytics {
    constructor() {
        this.blockTimeHistory = [];
        this.feeHistory = [];
        this.utilizationHistory = [];
    }

    // Calculate comprehensive network statistics for a block
    calculateNetworkStatistics(blockData, previousBlockData = null) {
        const stats = {
            block: this.calculateBlockStatistics(blockData),
            timing: this.calculateTimingStatistics(blockData, previousBlockData),
            fees: this.calculateFeeStatistics(blockData),
            dataAvailability: this.calculateDAStatistics(blockData),
            accounts: this.calculateAccountStatistics(blockData),
            validators: this.calculateValidatorStatistics(blockData)
        };

        // Update historical data
        this.updateHistoricalData(stats);

        return stats;
    }

    // Block-level statistics
    calculateBlockStatistics(blockData) {
        const { header, extrinsics, events } = blockData;
        
        const signedExtrinsics = extrinsics.filter(ext => ext.isSigned);
        const successfulExtrinsics = extrinsics.filter(ext => 
            !this.hasFailureEvent(ext.index, events)
        );

        return {
            number: header.number,
            hash: blockData.blockHash,
            parentHash: header.parentHash,
            stateRoot: header.stateRoot,
            extrinsicsRoot: header.extrinsicsRoot,
            totalExtrinsics: extrinsics.length,
            signedExtrinsics: signedExtrinsics.length,
            unsignedExtrinsics: extrinsics.length - signedExtrinsics.length,
            successfulExtrinsics: successfulExtrinsics.length,
            failedExtrinsics: extrinsics.length - successfulExtrinsics.length,
            totalEvents: events.length,
            blockSize: this.calculateBlockSize(blockData),
            utilization: this.calculateBlockUtilization(blockData)
        };
    }

    // Timing and performance statistics
    calculateTimingStatistics(blockData, previousBlockData) {
        const stats = {
            blockNumber: blockData.header.number,
            timestamp: blockData.timestamp || new Date().toISOString(),
            blockTime: null,
            blockTimeMs: null,
            avgBlockTime: null,
            blockProductionRate: null
        };

        if (previousBlockData && previousBlockData.timestamp && blockData.timestamp) {
            const currentTime = new Date(blockData.timestamp).getTime();
            const previousTime = new Date(previousBlockData.timestamp).getTime();
            stats.blockTimeMs = currentTime - previousTime;
            stats.blockTime = stats.blockTimeMs / 1000; // seconds

            // Update block time history
            this.blockTimeHistory.push(stats.blockTimeMs);
            if (this.blockTimeHistory.length > 100) {
                this.blockTimeHistory.shift(); // Keep last 100 blocks
            }

            // Calculate average block time
            if (this.blockTimeHistory.length > 0) {
                stats.avgBlockTime = this.blockTimeHistory.reduce((a, b) => a + b, 0) / this.blockTimeHistory.length;
                stats.blockProductionRate = 1000 / stats.avgBlockTime; // blocks per second
            }
        }

        return stats;
    }

    // Fee and transaction cost statistics
    calculateFeeStatistics(blockData) {
        const { extrinsics, events } = blockData;
        
        let totalTips = BigInt(0);
        let totalFees = BigInt(0);
        const feesByPallet = {};
        const tipDistribution = [];

        // Extract fee information from extrinsics
        for (const ext of extrinsics) {
            if (ext.signature && ext.signature.tip) {
                const tip = BigInt(ext.signature.tip);
                totalTips += tip;
                tipDistribution.push(Number(tip));
            }

            // Track fees by pallet
            const pallet = ext.method.pallet;
            if (!feesByPallet[pallet]) {
                feesByPallet[pallet] = { count: 0, totalFees: BigInt(0) };
            }
            feesByPallet[pallet].count++;
        }

        // Extract fee information from events
        for (const event of events) {
            if (event.pallet === 'transactionPayment' && event.eventName === 'TransactionFeePaid') {
                if (event.data && event.data.length >= 2) {
                    const fee = BigInt(event.data[1] || 0);
                    totalFees += fee;
                }
            }
        }

        const stats = {
            totalTips: totalTips.toString(),
            totalFees: totalFees.toString(),
            totalCost: (totalTips + totalFees).toString(),
            avgTip: extrinsics.length > 0 ? (totalTips / BigInt(extrinsics.length)).toString() : '0',
            avgFee: extrinsics.length > 0 ? (totalFees / BigInt(extrinsics.length)).toString() : '0',
            feesByPallet,
            tipDistribution: this.calculateDistributionStats(tipDistribution)
        };

        // Update fee history
        this.feeHistory.push({
            blockNumber: blockData.header.number,
            totalFees: Number(totalFees),
            totalTips: Number(totalTips),
            avgFee: Number(totalFees) / Math.max(extrinsics.length, 1)
        });

        if (this.feeHistory.length > 1000) {
            this.feeHistory.shift(); // Keep last 1000 blocks
        }

        return stats;
    }

    // Data Availability specific statistics
    calculateDAStatistics(blockData) {
        const { events, kate, storage } = blockData;
        
        const stats = {
            dataSubmissions: 0,
            uniqueApps: new Set(),
            totalDataSize: 0,
            blockUtilization: 0,
            appSpaceBreakdown: {},
            kateCommitment: null
        };

        // Extract DA submissions from events
        for (const event of events) {
            if (event.pallet === 'dataAvailability') {
                if (event.eventName === 'DataSubmitted' || event.eventName === 'Submitted') {
                    stats.dataSubmissions++;
                    
                    // Extract app ID and data size if available
                    if (event.data && event.data.length > 0) {
                        const appId = event.data[0];
                        stats.uniqueApps.add(appId.toString());
                        
                        // Data size is often in the second parameter
                        if (event.data.length > 1) {
                            const dataSize = parseInt(event.data[1]) || 0;
                            stats.totalDataSize += dataSize;
                            
                            // Track per-app statistics
                            if (!stats.appSpaceBreakdown[appId]) {
                                stats.appSpaceBreakdown[appId] = {
                                    submissions: 0,
                                    totalSize: 0
                                };
                            }
                            stats.appSpaceBreakdown[appId].submissions++;
                            stats.appSpaceBreakdown[appId].totalSize += dataSize;
                        }
                    }
                }
            }
        }

        // Kate commitment data
        if (kate && kate.blockLength) {
            stats.kateCommitment = {
                blockLength: kate.blockLength,
                hasDataProof: !!kate.sampleDataProof,
                hasRowData: !!kate.sampleRowData
            };

            // Calculate utilization if we have block dimensions
            if (kate.blockLength && typeof kate.blockLength === 'object') {
                const dimensions = kate.blockLength;
                if (dimensions.rows && dimensions.cols) {
                    const maxCapacity = dimensions.rows * dimensions.cols;
                    stats.blockUtilization = maxCapacity > 0 ? 
                        (stats.totalDataSize / maxCapacity) * 100 : 0;
                }
            }
        }

        // Data availability storage statistics
        if (storage && storage.dataAvailability) {
            const da = storage.dataAvailability;
            if (da.nextAppId) {
                stats.totalAppsRegistered = Number(da.nextAppId);
            }
            if (da.appKeys) {
                stats.activeApps = da.appKeys.length;
            }
            if (da.dataSubmissions) {
                stats.storedSubmissions = da.dataSubmissions.length;
            }
        }

        stats.uniqueApps = stats.uniqueApps.size;

        return stats;
    }

    // Account activity statistics
    calculateAccountStatistics(blockData) {
        const { accounts, storage } = blockData;
        
        const stats = {
            totalAccounts: 0,
            activeAccounts: 0,
            newAccounts: 0,
            balanceDistribution: {
                ranges: [],
                totalSupply: '0',
                averageBalance: '0'
            },
            accountActivity: {
                signers: new Set(),
                recipients: new Set(),
                totalTransactions: 0
            }
        };

        // From storage data
        if (storage && storage.system && storage.system.accounts) {
            stats.totalAccounts = storage.system.totalAccounts || storage.system.accounts.length;
            
            // Calculate balance statistics
            let totalBalance = BigInt(0);
            const balances = [];
            
            for (const account of storage.system.accounts) {
                const balance = BigInt(account.data?.free || 0);
                totalBalance += balance;
                balances.push(Number(balance));
                
                if (account.nonce > 0) {
                    stats.activeAccounts++;
                }
            }
            
            stats.balanceDistribution.totalSupply = totalBalance.toString();
            stats.balanceDistribution.averageBalance = stats.totalAccounts > 0 ? 
                (totalBalance / BigInt(stats.totalAccounts)).toString() : '0';
            stats.balanceDistribution.ranges = this.calculateBalanceRanges(balances);
        }

        // From extrinsics - track signers
        if (blockData.extrinsics) {
            for (const ext of blockData.extrinsics) {
                if (ext.signature && ext.signature.signer) {
                    stats.accountActivity.signers.add(ext.signature.signer);
                    stats.accountActivity.totalTransactions++;
                }
            }
        }

        // From events - track transfer recipients
        if (blockData.events) {
            for (const event of blockData.events) {
                if (event.pallet === 'balances' && event.eventName === 'Transfer') {
                    if (event.data && event.data.length >= 2) {
                        stats.accountActivity.recipients.add(event.data[1]);
                    }
                }
            }
        }

        stats.accountActivity.uniqueSigners = stats.accountActivity.signers.size;
        stats.accountActivity.uniqueRecipients = stats.accountActivity.recipients.size;

        return stats;
    }

    // Validator and consensus statistics
    calculateValidatorStatistics(blockData) {
        const stats = {
            totalValidators: 0,
            activeValidators: 0,
            blockAuthor: null,
            sessionInfo: null
        };

        // Extract block author from header (if available)
        if (blockData.header && blockData.header.digest) {
            // Block author is typically in the digest logs
            stats.blockAuthor = this.extractBlockAuthor(blockData.header.digest);
        }

        // Session information from storage
        if (blockData.storage && blockData.storage.session) {
            const session = blockData.storage.session;
            if (session.validators) {
                stats.totalValidators = session.validatorCount || session.validators.length;
                stats.activeValidators = session.validators.length;
                stats.sessionInfo = {
                    validators: session.validators
                };
            }
        }

        // Staking information
        if (blockData.storage && blockData.storage.staking) {
            const staking = blockData.storage.staking;
            if (staking.currentEra !== undefined) {
                stats.currentEra = staking.currentEra;
            }
        }

        return stats;
    }

    // Calculate block analytics (performance metrics)
    calculateBlockAnalytics(blockData, networkStats) {
        const analytics = {
            blockNumber: blockData.header.number,
            blockHash: blockData.blockHash,
            performance: {
                tps: 0, // Transactions per second
                bps: 0, // Bytes per second
                efficiency: 0
            },
            fees: {
                percentiles: this.calculateFeePercentiles(),
                distribution: this.calculateFeeDistribution()
            },
            dataAvailability: {
                utilization: networkStats.dataAvailability.blockUtilization || 0,
                efficiency: this.calculateDAEfficiency(networkStats.dataAvailability),
                appDistribution: networkStats.dataAvailability.appSpaceBreakdown
            },
            network: {
                congestion: this.calculateNetworkCongestion(networkStats),
                participation: this.calculateNetworkParticipation(networkStats)
            }
        };

        // Calculate TPS
        if (networkStats.timing.blockTimeMs && networkStats.timing.blockTimeMs > 0) {
            analytics.performance.tps = (networkStats.block.totalExtrinsics * 1000) / networkStats.timing.blockTimeMs;
        }

        // Calculate BPS (Bytes per second)
        if (networkStats.timing.blockTimeMs && networkStats.block.blockSize) {
            analytics.performance.bps = (networkStats.block.blockSize * 1000) / networkStats.timing.blockTimeMs;
        }

        // Calculate efficiency (successful transactions / total transactions)
        if (networkStats.block.totalExtrinsics > 0) {
            analytics.performance.efficiency = 
                networkStats.block.successfulExtrinsics / networkStats.block.totalExtrinsics;
        }

        return analytics;
    }

    // Helper methods
    hasFailureEvent(extrinsicIndex, events) {
        return events.some(event => 
            event.phase && 
            event.phase.ApplyExtrinsic === extrinsicIndex && 
            event.pallet === 'system' && 
            event.eventName === 'ExtrinsicFailed'
        );
    }

    calculateBlockSize(blockData) {
        // Estimate block size based on raw hex data
        let totalSize = 0;
        
        if (blockData.extrinsics) {
            for (const ext of blockData.extrinsics) {
                if (ext.rawHex) {
                    totalSize += ext.rawHex.length / 2; // Hex to bytes
                }
            }
        }
        
        return totalSize;
    }

    calculateBlockUtilization(blockData) {
        // This would typically be based on weight/gas usage
        // For now, we'll use extrinsic count as a proxy
        const maxExtrinsics = 1000; // Theoretical maximum
        return (blockData.extrinsics.length / maxExtrinsics) * 100;
    }

    calculateDistributionStats(values) {
        if (values.length === 0) return { min: 0, max: 0, avg: 0, median: 0 };
        
        const sorted = values.sort((a, b) => a - b);
        const sum = sorted.reduce((a, b) => a + b, 0);
        
        return {
            min: sorted[0],
            max: sorted[sorted.length - 1],
            avg: sum / sorted.length,
            median: sorted[Math.floor(sorted.length / 2)],
            p25: sorted[Math.floor(sorted.length * 0.25)],
            p75: sorted[Math.floor(sorted.length * 0.75)],
            p95: sorted[Math.floor(sorted.length * 0.95)]
        };
    }

    calculateBalanceRanges(balances) {
        const ranges = [
            { min: 0, max: 1000, count: 0 },
            { min: 1000, max: 10000, count: 0 },
            { min: 10000, max: 100000, count: 0 },
            { min: 100000, max: 1000000, count: 0 },
            { min: 1000000, max: Infinity, count: 0 }
        ];

        for (const balance of balances) {
            for (const range of ranges) {
                if (balance >= range.min && balance < range.max) {
                    range.count++;
                    break;
                }
            }
        }

        return ranges;
    }

    extractBlockAuthor(digest) {
        // This would extract the block author from the digest logs
        // Implementation depends on the specific digest format
        try {
            if (digest && digest.logs) {
                for (const log of digest.logs) {
                    if (log.PreRuntime || log.Consensus) {
                        // Extract author information
                        return null; // Placeholder
                    }
                }
            }
        } catch (error) {
            console.warn(`⚠️ Block author extraction failed: ${error.message}`);
        }
        return null;
    }

    calculateFeePercentiles() {
        if (this.feeHistory.length === 0) return null;
        
        const fees = this.feeHistory.map(h => h.avgFee).sort((a, b) => a - b);
        return {
            p25: fees[Math.floor(fees.length * 0.25)],
            p50: fees[Math.floor(fees.length * 0.5)],
            p75: fees[Math.floor(fees.length * 0.75)],
            p95: fees[Math.floor(fees.length * 0.95)]
        };
    }

    calculateFeeDistribution() {
        if (this.feeHistory.length === 0) return null;
        
        const recentFees = this.feeHistory.slice(-100); // Last 100 blocks
        const totalFees = recentFees.reduce((sum, h) => sum + h.totalFees, 0);
        const avgFee = totalFees / recentFees.length;
        
        return {
            recent: recentFees.length,
            totalFees,
            avgFee,
            trend: this.calculateTrend(recentFees.map(h => h.avgFee))
        };
    }

    calculateDAEfficiency(daStats) {
        if (daStats.totalDataSize === 0) return 0;
        
        // Efficiency could be calculated as actual data / theoretical maximum
        return Math.min(daStats.blockUtilization / 100, 1);
    }

    calculateNetworkCongestion(networkStats) {
        // Simple congestion metric based on block utilization and success rate
        const utilizationScore = networkStats.block.utilization / 100;
        const successRate = networkStats.block.totalExtrinsics > 0 ? 
            networkStats.block.successfulExtrinsics / networkStats.block.totalExtrinsics : 1;
        
        return {
            score: (utilizationScore * 0.7) + ((1 - successRate) * 0.3),
            level: this.getCongestionLevel(utilizationScore, successRate)
        };
    }

    calculateNetworkParticipation(networkStats) {
        return {
            activeAccounts: networkStats.accounts.accountActivity?.uniqueSigners || 0,
            totalTransactions: networkStats.accounts.accountActivity?.totalTransactions || 0,
            validatorParticipation: networkStats.validators.activeValidators || 0
        };
    }

    getCongestionLevel(utilization, successRate) {
        if (utilization > 0.8 || successRate < 0.9) return 'High';
        if (utilization > 0.5 || successRate < 0.95) return 'Medium';
        return 'Low';
    }

    calculateTrend(values) {
        if (values.length < 2) return 'stable';
        
        const recent = values.slice(-10);
        const older = values.slice(-20, -10);
        
        if (recent.length === 0 || older.length === 0) return 'stable';
        
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        
        const change = (recentAvg - olderAvg) / olderAvg;
        
        if (change > 0.1) return 'increasing';
        if (change < -0.1) return 'decreasing';
        return 'stable';
    }

    updateHistoricalData(stats) {
        // Update utilization history
        this.utilizationHistory.push({
            blockNumber: stats.block.number,
            utilization: stats.block.utilization,
            daUtilization: stats.dataAvailability.blockUtilization
        });

        if (this.utilizationHistory.length > 1000) {
            this.utilizationHistory.shift();
        }
    }

    // Get summary statistics across multiple blocks
    getSummaryStatistics() {
        return {
            blockProcessing: {
                totalProcessed: this.blockTimeHistory.length,
                avgBlockTime: this.blockTimeHistory.length > 0 ? 
                    this.blockTimeHistory.reduce((a, b) => a + b, 0) / this.blockTimeHistory.length : 0
            },
            fees: {
                totalBlocks: this.feeHistory.length,
                recentTrend: this.calculateTrend(this.feeHistory.map(h => h.avgFee))
            },
            utilization: {
                avgUtilization: this.utilizationHistory.length > 0 ?
                    this.utilizationHistory.reduce((sum, h) => sum + h.utilization, 0) / this.utilizationHistory.length : 0,
                avgDAUtilization: this.utilizationHistory.length > 0 ?
                    this.utilizationHistory.reduce((sum, h) => sum + (h.daUtilization || 0), 0) / this.utilizationHistory.length : 0
            }
        };
    }
}

module.exports = { ExplorerAnalytics };