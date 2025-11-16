


import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { type WorkItem, type TaskSummary } from '../types';
import { TaskAnalysisFilters } from './TaskAnalysisFilters';
import { AnimatedCounter } from './AnimatedCounter';
import { WorkItemList } from './WorkItemList';
import { SimpleBarChart } from './SimpleBarChart';

interface TaskAnalysisViewProps {
    allTasks: WorkItem[] | null;
    isLoading: boolean;
    error: string | null;
    selectedDevs: string[];
    onSelectedDevsChange: (devs: string[]) => void;
    selectedTag: string | null;
    onSelectedTagChange: (tag: string | null) => void;
    onShowDetails: (item: WorkItem) => void;
    onNavigateToChildren: (item: WorkItem) => void;
    getTaskSummary: (taskId: number) => Promise<{ estimated: number; invested: number }>;
    rootItems: WorkItem[];
}

const LoadingSpinner: React.FC = () => (
    <div className="flex flex-col justify-center items-center p-10 text-center">
        <svg className="animate-spin h-10 w-10 text-brand-primary mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-lg font-semibold">Cargando tareas del proyecto...</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Esto puede tardar un momento.</p>
    </div>
);

const MetricCard: React.FC<{ title: string; value: number; unit: string; isLoading: boolean; }> = ({ title, value, unit, isLoading }) => (
    <div className="p-4 bg-light-bg dark:bg-dark-bg/50 rounded-lg text-center h-full flex flex-col justify-center">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        {isLoading ? (
            <div className="h-9 mt-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-800 dark:border-gray-200"></div>
            </div>
        ) : (
            <p className="text-3xl font-bold mt-1 text-gray-800 dark:text-gray-200">
                <AnimatedCounter value={value} />{unit}
            </p>
        )}
    </div>
);

export const TaskAnalysisView: React.FC<TaskAnalysisViewProps> = ({
    allTasks,
    isLoading,
    error,
    selectedDevs,
    onSelectedDevsChange,
    selectedTag,
    onSelectedTagChange,
    onShowDetails,
    onNavigateToChildren,
    getTaskSummary,
    rootItems
}) => {

    const [isSummariesLoading, setIsSummariesLoading] = useState(false);
    const [taskSummaries, setTaskSummaries] = useState<Map<number, TaskSummary>>(new Map());

    const availableDevs = useMemo(() => {
        if (!allTasks) return [];
        const devs = new Set<string>();
        allTasks.forEach(task => {
            if (task.fields['System.AssignedTo']?.displayName) {
                devs.add(task.fields['System.AssignedTo'].displayName);
            }
        });
        return [...devs].sort();
    }, [allTasks]);
    
    const tasksOfSelectedDevs = useMemo(() => {
        if (!allTasks || selectedDevs.length === 0) return [];
        const devSet = new Set(selectedDevs);
        return allTasks.filter(task => devSet.has(task.fields['System.AssignedTo']?.displayName));
    }, [allTasks, selectedDevs]);

    const availableTags = useMemo(() => {
        const tags = new Set<string>();
        tasksOfSelectedDevs.forEach(task => {
            task.fields['System.Tags']?.split('; ').forEach(tag => {
                if (tag.trim()) tags.add(tag.trim());
            });
        });
        return [...tags].sort();
    }, [tasksOfSelectedDevs]);

    // Valida que el tag seleccionado siga siendo válido cuando cambian los desarrolladores.
    useEffect(() => {
        if (selectedTag && !availableTags.includes(selectedTag)) {
            onSelectedTagChange(null);
        }
    }, [availableTags, selectedTag, onSelectedTagChange]);

    const filteredTasks = useMemo(() => {
        if (!selectedTag || tasksOfSelectedDevs.length === 0) return [];
        return tasksOfSelectedDevs.filter(task => {
            const itemTags = new Set(task.fields['System.Tags']?.split('; ').map(t => t.trim()) || []);
            return itemTags.has(selectedTag);
        });
    }, [tasksOfSelectedDevs, selectedTag]);

     useEffect(() => {
        const calculateSummaries = async () => {
            if (filteredTasks.length === 0) {
                setTaskSummaries(new Map());
                return;
            }
            setIsSummariesLoading(true);
            try {
                const summaryPromises = filteredTasks.map(task => getTaskSummary(task.id));
                const results = await Promise.allSettled(summaryPromises);

                const newSummaries = new Map<number, TaskSummary>();
                results.forEach((result, index) => {
                    const taskId = filteredTasks[index].id;
                    if (result.status === 'fulfilled') {
                        newSummaries.set(taskId, result.value);
                    } else {
                        console.error(`Failed to fetch summary for task ${taskId}:`, result.reason);
                        // Set a default summary for the failed task to avoid breaking calculations
                        newSummaries.set(taskId, { estimated: 0, invested: 0 });
                    }
                });
                setTaskSummaries(newSummaries);
            } catch (e) {
                console.error("An unexpected error occurred during summary calculation:", e);
                setTaskSummaries(new Map());
            } finally {
                setIsSummariesLoading(false);
            }
        };
        calculateSummaries();
    }, [filteredTasks, getTaskSummary]);

    const globalMetrics = useMemo(() => {
        const totalTasks = filteredTasks.length;
        // FIX: Ensure 'invested' is treated as a number to prevent type errors in the reduction.
        const totalInvestedHours = Array.from(taskSummaries.values()).reduce((acc: number, curr: TaskSummary) => acc + (Number(curr.invested) || 0), 0);
        const avgHoursPerTask = totalTasks > 0 ? parseFloat((totalInvestedHours / totalTasks).toFixed(2)) : 0;
        return { totalTasks, totalInvestedHours, avgHoursPerTask };
    }, [filteredTasks, taskSummaries]);

    const devMetrics = useMemo(() => {
        const metricsByDev = new Map<string, { taskCount: number; investedHours: number }>();
        filteredTasks.forEach(task => {
            const devName = task.fields['System.AssignedTo']?.displayName;
            const summary = taskSummaries.get(task.id);
            if (devName && summary) {
                const current = metricsByDev.get(devName) || { taskCount: 0, investedHours: 0 };
                // FIX: Ensure 'invested' is treated as a number before adding it to the total.
                const invested = Number(summary.invested) || 0;
                metricsByDev.set(devName, {
                    taskCount: current.taskCount + 1,
                    investedHours: current.investedHours + invested,
                });
            }
        });

        return Array.from(metricsByDev.entries())
            .map(([devName, data]) => ({ 
                devName, 
                ...data,
                averageHours: data.taskCount > 0 ? parseFloat((data.investedHours / data.taskCount).toFixed(2)) : 0
            }))
            .sort((a, b) => b.investedHours - a.investedHours);
    }, [filteredTasks, taskSummaries]);
    
    const taskToPbiTitleMap = useMemo(() => {
        if (!allTasks || !rootItems) {
            return new Map<number, string>();
        }
        
        const allItemsById = new Map<number, WorkItem>();
        allTasks.forEach(task => allItemsById.set(task.id, task));
        rootItems.forEach(pbi => allItemsById.set(pbi.id, pbi));
        
        const pbiMap = new Map<number, string>();
        const traversalMemo = new Map<number, WorkItem | null>();

        const findRootPbi = (itemId: number): WorkItem | null => {
            if (traversalMemo.has(itemId)) {
                return traversalMemo.get(itemId)!;
            }

            const item = allItemsById.get(itemId);
            if (!item) {
                traversalMemo.set(itemId, null);
                return null;
            }
            if (item.fields['System.WorkItemType'] === 'Product Backlog Item') {
                traversalMemo.set(itemId, item);
                return item;
            }
            
            const parentId = item.fields['System.Parent'];
            if (!parentId) {
                traversalMemo.set(itemId, null);
                return null;
            }

            const root = findRootPbi(parentId);
            traversalMemo.set(itemId, root);
            return root;
        };

        allTasks.forEach(task => {
            const rootPbi = findRootPbi(task.id);
            if (rootPbi) {
                pbiMap.set(task.id, rootPbi.fields['System.Title']);
            }
        });
        
        return pbiMap;
    }, [allTasks, rootItems]);


    const chartData = useMemo(() => devMetrics.map(dev => ({
        label: dev.devName,
        value: dev.investedHours,
    })), [devMetrics]);

    const showContent = selectedDevs.length > 0 && selectedTag;

    const handleExport = useCallback(() => {
        if (!selectedTag || devMetrics.length === 0) return;

        const formatRow = (row: (string | number)[]) => 
            row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',');

        let csvContent = "data:text/csv;charset=utf-8,";
        
        csvContent += "Reporte de Analisis de Tareas\n";
        csvContent += `Tag Seleccionado:,${selectedTag}\n`;
        csvContent += `Desarrolladores:,"${selectedDevs.join('; ')}"\n\n`;

        csvContent += "Metricas Globales\n";
        csvContent += formatRow(['Metrica', 'Valor']) + "\n";
        const globalRows = [
            ['Horas Totales Invertidas', `${globalMetrics.totalInvestedHours}h`],
            ['Cantidad Total de Tareas', globalMetrics.totalTasks],
            ['Promedio Horas / Tarea', `${globalMetrics.avgHoursPerTask}h`]
        ];
        globalRows.forEach(row => {
            csvContent += formatRow(row) + "\n";
        });
        csvContent += "\n";

        csvContent += "Metricas por Desarrollador\n";
        const devHeaders = ['Desarrollador', 'Horas Invertidas', 'Cantidad de Tareas', 'Promedio Horas / Tarea'];
        csvContent += formatRow(devHeaders) + "\n";
        devMetrics.forEach(dev => {
            const row = [
                dev.devName,
                `${dev.investedHours}h`,
                dev.taskCount,
                `${dev.averageHours}h`
            ];
            csvContent += formatRow(row) + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        const safeTag = selectedTag.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.setAttribute("download", `analisis_tareas_${safeTag}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [selectedTag, selectedDevs, globalMetrics, devMetrics]);

    if (isLoading) return <LoadingSpinner />;
    if (error) return <div className="text-red-500 text-center p-4">{error}</div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <TaskAnalysisFilters
                availableDevs={availableDevs}
                selectedDevs={selectedDevs}
                onSelectedDevsChange={onSelectedDevsChange}
                availableTags={availableTags}
                selectedTag={selectedTag}
                onSelectedTagChange={onSelectedTagChange}
                isDisabled={!allTasks}
            />

            {!showContent && (
                <div className="text-center py-10 px-6 bg-light-card dark:bg-dark-card rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Inicia tu Análisis</h3>
                    <p className="mt-2 text-gray-500 dark:text-gray-400">Selecciona al menos un desarrollador y un tag de tarea para ver las métricas.</p>
                </div>
            )}

            {showContent && (
                <>
                    <div className="p-4 bg-light-card dark:bg-dark-card rounded-lg shadow-md">
                        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100">Métricas Globales (Tag: {selectedTag})</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <MetricCard title="Horas Totales Invertidas" value={globalMetrics.totalInvestedHours} unit="h" isLoading={isSummariesLoading} />
                            <MetricCard title="Cantidad Total de Tareas" value={globalMetrics.totalTasks} unit="" isLoading={isSummariesLoading} />
                            <MetricCard title="Promedio Horas / Tarea" value={globalMetrics.avgHoursPerTask} unit="h" isLoading={isSummariesLoading} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 p-4 bg-light-card dark:bg-dark-card rounded-lg shadow-md">
                            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100">Desglose por Desarrollador</h3>
                            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                {devMetrics.map(({ devName, taskCount, investedHours, averageHours }, index) => (
                                     <div key={devName} className={`grid grid-cols-1 md:grid-cols-4 items-center gap-2 py-2 ${index > 0 ? 'border-t border-gray-200 dark:border-gray-700' : ''}`}>
                                        <p className="font-medium text-gray-700 dark:text-gray-300 truncate col-span-1" title={devName}>{devName}</p>
                                        <div className="md:col-span-3 text-right flex flex-wrap justify-end items-center gap-x-4 gap-y-1">
                                            <span className="text-sm text-center"><span className="font-bold">{investedHours}</span>h invertidas</span>
                                            <span className="text-sm text-center"><span className="font-bold">{taskCount}</span> tarea(s)</span>
                                            <span className="text-sm text-center"><span className="font-bold">{averageHours}</span>h prom./tarea</span>
                                        </div>
                                    </div>
                                ))}
                                {devMetrics.length === 0 && !isSummariesLoading && <p className="text-sm text-center text-gray-500 dark:text-gray-400 py-4">No hay datos para los desarrolladores seleccionados.</p>}
                            </div>
                        </div>
                        <div className="p-4 bg-light-card dark:bg-dark-card rounded-lg shadow-md">
                            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100">Horas Invertidas por Dev</h3>
                             {chartData.length > 0 && !isSummariesLoading ? (
                                <SimpleBarChart data={chartData} />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                                    {isSummariesLoading ? 'Calculando...' : 'No hay datos para mostrar.'}
                                </div>
                            )}
                        </div>
                    </div>
                    
                     <div>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                                Tareas Filtradas ({filteredTasks.length})
                            </h2>
                            <button
                                onClick={handleExport}
                                disabled={filteredTasks.length === 0 || isSummariesLoading}
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                                Exportar Reporte
                            </button>
                        </div>

                        {filteredTasks.length > 0 ? (
                            <WorkItemList
                                items={filteredTasks}
                                onShowDetails={onShowDetails}
                                onNavigateToChildren={onNavigateToChildren}
                                taskSummaries={taskSummaries}
                                isLoadingSummaries={isSummariesLoading}
                                rootItems={rootItems}
                                taskToPbiTitleMap={taskToPbiTitleMap}
                            />
                        ) : (
                            <div className="text-center py-10 px-6 bg-light-card dark:bg-dark-card rounded-lg shadow-md">
                                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">No se encontraron tareas</h3>
                                <p className="mt-2 text-gray-500 dark:text-gray-400">Ninguna tarea coincide con los filtros seleccionados.</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};