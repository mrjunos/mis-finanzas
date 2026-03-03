import re

with open('src/components/Insights.jsx', 'r') as f:
    content = f.read()

# 1. Remove burnRate memo
content = re.sub(r'// 2\. Burn Rate.*?return monthsCounted > 0 \? totalExpenses / monthsCounted : 0;\n    \}, \[filteredTransactions, today\]\);\n', '', content, flags=re.DOTALL)

# 2. Remove currencyExposure memo
content = re.sub(r'// 3\. Currency Exposure.*?return \{\n            cop: \(cop / totalInCop\) \* 100,\n            usd: \(\(usd \* EXCHANGE_RATE\) / totalInCop\) \* 100\n        \};\n    \}, \[getTotals, currentContext\]\);\n', '', content, flags=re.DOTALL)

# 3. Remove cashflowData memo
content = re.sub(r'// 4\. Cashflow History.*?return data;\n    \}, \[filteredTransactions, today\]\);\n', '', content, flags=re.DOTALL)

# 4. Replace layout
layout_regex = r'\{\/\* Top Metrics Area \*\/}.*?\{\/\* Bottom Row: Category, Card Breakdown, Top Fugas \*\/}'

new_layout = """{/* Top Area: Actividad Reciente & KPIs */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
                    {/* 1. Actividad Reciente */}
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 flex flex-col h-full min-h-[400px]">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-500">history</span> Actividad Reciente
                            </h3>
                            <button
                                onClick={() => onNavigate && onNavigate('transactions')}
                                className="text-[10px] font-bold text-primary-dark hover:underline uppercase tracking-wider"
                            >
                                Ver Todo
                            </button>
                        </div>
                        <div className="space-y-1 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                                {filteredTransactions.length === 0 ? (
                                    <p className="text-xs text-slate-500 py-4 text-center">No hay transacciones registradas.</p>
                                ) : (
                                    filteredTransactions.slice(0, 8).map(tx => {
                                        const categoryLabels = {
                                            'general': 'General',
                                            'food': 'Comida y Salidas',
                                            'software': 'Software',
                                            'services': 'Servicios'
                                        };

                                        const currencyCode = tx.currency || 'USD';
                                        const formattedAmount = formatCurrency(Number(tx.amount), currencyCode);

                                        let txDate;
                                        try {
                                            txDate = tx.date && tx.date.toDate ? tx.date.toDate() : new Date(tx.date);
                                        } catch {
                                            txDate = new Date();
                                        }

                                        return (
                                            <div
                                                key={tx.id}
                                                className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group"
                                                onClick={() => {
                                                    setEditingTransaction(tx);
                                                    setModalMode('transaction');
                                                    setIsModalOpen(true);
                                                }}
                                            >
                                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isTransferTx(tx) ? 'bg-indigo-50 text-indigo-500' : tx.context === 'business' ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'}`}>
                                                    <span className="material-symbols-outlined text-lg">
                                                        {isTransferTx(tx) ? 'swap_horiz' : tx.context === 'business' ? 'domain' : 'person'}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-slate-800 truncate">{tx.title}</p>
                                                    <p className="text-[10px] text-slate-400 uppercase font-medium capitalize truncate">
                                                        {isTransferTx(tx)
                                                            ? `${tx.card || '?'} → ${tx.destinationCard || '?'}`
                                                            : <>{tx.context === 'business' ? 'Negocio' : 'Personal'}{tx.card && ` • ${tx.card}`}</>}
                                                        • {categoryLabels[tx.category] || tx.category}
                                                        • {format(txDate, 'MMM dd, yyyy')}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-end justify-center gap-1">
                                                    <p className={`text-xs font-extrabold ${isTransferTx(tx) ? 'text-indigo-600' : tx.type === 'credit' ? 'text-green-600' : 'text-slate-800'}`}>
                                                        {isTransferTx(tx) ? '' : tx.type === 'credit' ? '+' : '-'}{formattedAmount}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {tx.comments && <span className="material-symbols-outlined text-[12px] text-slate-400" title={tx.comments}>chat</span>}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setConfirmDelete({ isOpen: true, txId: tx.id });
                                                            }}
                                                            className="text-slate-300 hover:text-red-500 transition-colors"
                                                            title="Eliminar transacción"
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">delete</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                        </div>
                    </div>

                    {/* 2. Top Metrics Area */}
                    <div className="flex flex-col gap-6">
                        {/* Main Balance */}
                        {renderCurrencyWidgetContent(
                            activeBalanceTitle,
                            activeBalanceData,
                            activeBalanceIcon,
                            activeBalanceClass,
                            activeBalanceLineContent
                        )}

                        {/* Savings Rate */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 flex flex-col justify-between transition-transform hover:scale-[1.02] duration-300 flex-1">
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tasa de Ahorro</p>
                                    <div className="p-2 bg-teal-50 rounded-xl text-teal-500">
                                        <span className="material-symbols-outlined text-lg">trending_up</span>
                                    </div>
                                </div>
                                <h2 className="text-3xl font-bold text-gray-800">{savingsRate.toFixed(1)}%</h2>
                            </div>
                            <p className={`text-xs flex items-center mt-4 font-bold ${savingsRateTrend >= 0 ? 'text-teal-500' : 'text-red-500'}`}>
                                <span className="material-symbols-outlined text-[14px] mr-1">
                                    {savingsRateTrend >= 0 ? 'north_east' : 'south_east'}
                                </span>
                                {savingsRateTrend >= 0 ? '+' : ''}{savingsRateTrend.toFixed(1)}% vs mes pasado
                            </p>
                        </div>
                    </div>
                </div>

                {/* Bottom Row: Category, Card Breakdown, Top Fugas */}"""

content = re.sub(layout_regex, new_layout, content, flags=re.DOTALL)

with open('src/components/Insights.jsx', 'w') as f:
    f.write(content)

