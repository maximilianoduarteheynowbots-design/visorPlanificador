
import React, { useState, useMemo, useEffect } from 'react';
import { type WorkItem } from '../types';
import { getWeekDateRange } from '../utils/dateCalculator';
import { PlanningSummary } from './PlanningSummary';

interface WeeklyPlannerViewProps {
    workItems: WorkItem[];
}

// Para la transferencia de datos en drag & drop
interface DraggableProject {
    id: number;
    title: string;
}

// Para los proyectos ya en el plan semanal
interface PlannedProject {
    id: number;
    title: string;
    assignedHours: number;
}

// Para la estructura de datos de una semana
interface WeekData {
    weekIndex: number;
    projects: PlannedProject[];
}

// Para los proyectos en el panel izquierdo (incluye datos para edición)
interface DevProject {
    id: number;
    title: string;
}

const formatDate = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
};

export const WeeklyPlannerView: React.FC<WeeklyPlannerViewProps> = ({ workItems }) => {
    const [selectedDeveloper, setSelectedDeveloper] = useState<string | null>(null);
    const [plan, setPlan] = useState<WeekData[]>([]);
    const [weekCount, setWeekCount] = useState(4);
    const [projectSearch, setProjectSearch] = useState('');
    const [view, setView] = useState<'planner' | 'summary'>('planner');
    const [draggedOverWeek, setDraggedOverWeek] = useState<number | null>(null);
    const [projectHours, setProjectHours] = useState<Map<number, number>>(new Map());

    const availableDevs = useMemo(() => {
        const devs = new Set<string>();
        workItems.forEach(item => {
            if (item.fields['System.AssignedTo']?.displayName) {
                devs.add(item.fields['System.AssignedTo'].displayName);
            }
        });
        return [...devs].sort();
    }, [workItems]);

    const devProjects = useMemo((): DevProject[] => {
        if (!selectedDeveloper) return [];
        const COMPLETED_STATES = ['Done', 'Closed', 'Resolved', 'Removed'];
        return workItems
            .filter(wi => 
                wi.fields['System.AssignedTo']?.displayName === selectedDeveloper &&
                !COMPLETED_STATES.includes(wi.fields['System.State'])
            )
            .map(wi => ({
                id: wi.id,
                title: wi.fields['System.Title'],
            }));
    }, [workItems, selectedDeveloper]);

    useEffect(() => {
        const newHoursMap = new Map<number, number>();
        if (selectedDeveloper) {
            workItems
                .filter(wi => wi.fields['System.AssignedTo']?.displayName === selectedDeveloper)
                .forEach(wi => {
                    newHoursMap.set(wi.id, (wi.fields['Custom.Hspendientes'] as number) || 0);
                });
        }
        setProjectHours(newHoursMap);
    }, [selectedDeveloper, workItems]);


    const filteredProjectsForPanel = useMemo(() => {
        return devProjects.filter(p => p.title.toLowerCase().includes(projectSearch.toLowerCase()));
    }, [devProjects, projectSearch]);

    const plannedProjectIds = useMemo(() => {
        const ids = new Set<number>();
        plan.forEach(week => {
            week.projects.forEach(p => ids.add(p.id));
        });
        return ids;
    }, [plan]);

    const plannedHoursMap = useMemo(() => {
        const totals = new Map<number, number>();
        plan.forEach(week => {
            week.projects.forEach(project => {
                totals.set(project.id, (totals.get(project.id) || 0) + project.assignedHours);
            });
        });
        return totals;
    }, [plan]);

    const handleDeveloperChange = (dev: string) => {
        setSelectedDeveloper(dev);
        setPlan([]);
        setWeekCount(4);
        setProjectSearch('');
        setView('planner');
    };
    
    const handlePendingHoursChange = (projectId: number, value: string) => {
        const numericValue = parseInt(value, 10);
        const newHours = isNaN(numericValue) || numericValue < 0 ? 0 : numericValue;

        setProjectHours(prevMap => {
            const newMap = new Map(prevMap);
            newMap.set(projectId, newHours);
            return newMap;
        });
    };

    const onDragStart = (e: React.DragEvent<HTMLDivElement>, project: DevProject) => {
        const draggableData: DraggableProject = { id: project.id, title: project.title };
        e.dataTransfer.setData("application/json", JSON.stringify(draggableData));
        e.dataTransfer.effectAllowed = "move";
    };

    const onDragOver = (e: React.DragEvent<HTMLDivElement>, weekIndex: number) => {
        e.preventDefault();
        if (draggedOverWeek !== weekIndex) {
            setDraggedOverWeek(weekIndex);
        }
    };

    const onDragLeave = () => {
        setDraggedOverWeek(null);
    };

    const onDrop = (e: React.DragEvent<HTMLDivElement>, weekIndex: number) => {
        e.preventDefault();
        const projectData: DraggableProject = JSON.parse(e.dataTransfer.getData("application/json"));
        setDraggedOverWeek(null);

        const weekExistsInPlan = plan.some(w => w.weekIndex === weekIndex && w.projects.some(p => p.id === projectData.id));
        if (weekExistsInPlan) return;

        setPlan(currentPlan => {
            const newPlan = [...currentPlan];
            let week = newPlan.find(w => w.weekIndex === weekIndex);
            
            if (!week) {
                week = { weekIndex, projects: [] };
                newPlan.push(week);
            }
            
            if (!week.projects.some(p => p.id === projectData.id)) {
                week.projects.push({ ...projectData, assignedHours: 0 });
            }
            
            newPlan.sort((a,b) => a.weekIndex - b.weekIndex);
            return newPlan;
        });
    };

    const handleAddWeek = () => {
        setWeekCount(c => c + 1);
    };

    const handleHoursChange = (weekIndex: number, projectId: number, hours: string) => {
        const numericHours = parseInt(hours, 10);
        const newHours = isNaN(numericHours) || numericHours < 0 ? 0 : numericHours;

        setPlan(currentPlan => {
            return currentPlan.map(week => {
                if (week.weekIndex === weekIndex) {
                    return { ...week, projects: week.projects.map(p => p.id === projectId ? { ...p, assignedHours: newHours } : p) };
                }
                return week;
            });
        });
    };

    const removeProjectFromWeek = (weekIndex: number, projectId: number) => {
        setPlan(currentPlan => {
            return currentPlan.map(week => {
                if (week.weekIndex === weekIndex) {
                    return { ...week, projects: week.projects.filter(p => p.id !== projectId) };
                }
                return week;
            }).filter(week => week.projects.length > 0);
        });
    };

    const finalCalculatedPlan = useMemo(() => {
        const allWeeksData = Array.from({ length: weekCount }, (_, i) => {
            const { startDate, endDate } = getWeekDateRange(i);
            const weekDataInPlan = plan.find(w => w.weekIndex === i);
            const projects = weekDataInPlan ? weekDataInPlan.projects : [];
            const totalHours = projects.reduce((sum, p) => sum + p.assignedHours, 0);

            return {
                weekIndex: i,
                startDate: formatDate(startDate),
                endDate: formatDate(endDate),
                projects,
                totalHours,
            };
        });
        
        return allWeeksData.filter(week => week.projects.length > 0);
    }, [plan, weekCount]);


    if (view === 'summary') {
        return (
            <PlanningSummary
                plan={finalCalculatedPlan}
                developer={selectedDeveloper || ''}
                onBackToPlanner={() => setView('planner')}
                projectHoursMap={projectHours}
            />
        );
    }

    const weeksToRender = Array.from({ length: weekCount }, (_, i) => i);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="p-4 bg-light-card/80 dark:bg-dark-card/80 rounded-lg shadow-sm flex flex-col md:flex-row md:items-end gap-4">
                <div className="flex-1">
                    <label htmlFor="dev-selector" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Seleccionar Desarrollador</label>
                    <select
                        id="dev-selector"
                        value={selectedDeveloper || ''}
                        onChange={e => handleDeveloperChange(e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-light-card dark:bg-dark-card focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    >
                        <option value="" disabled>-- Elige un desarrollador --</option>
                        {availableDevs.map(dev => <option key={dev} value={dev}>{dev}</option>)}
                    </select>
                </div>
                <button
                    onClick={() => setView('summary')}
                    disabled={!selectedDeveloper || finalCalculatedPlan.length === 0}
                    className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    Procesar Plan
                </button>
            </div>
            
            {!selectedDeveloper ? (
                <div className="text-center py-10 px-6 bg-light-card dark:bg-dark-card rounded-lg shadow-md">
                   <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Comienza a Planificar</h3>
                   <p className="mt-2 text-gray-500 dark:text-gray-400">Selecciona un desarrollador para ver su panel de proyectos y empezar a planificar.</p>
               </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-6 h-[70vh]">
                    {/* Project Panel */}
                    <div className="lg:w-1/3 bg-light-card dark:bg-dark-card p-4 rounded-lg shadow-md flex flex-col">
                        <h3 className="text-lg font-semibold mb-2">Proyectos Disponibles</h3>
                        <div className="relative mb-2">
                             <input
                                type="search"
                                placeholder="Buscar proyecto..."
                                value={projectSearch}
                                onChange={e => setProjectSearch(e.target.value)}
                                className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-light-bg dark:bg-dark-bg/50 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            />
                            <svg className="h-4 w-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                            {filteredProjectsForPanel.map(project => {
                                const isPlanned = plannedProjectIds.has(project.id);
                                const currentPending = projectHours.get(project.id) ?? 0;
                                const totalPlanned = plannedHoursMap.get(project.id) ?? 0;
                                const isOverPlanned = totalPlanned > currentPending;
                                const progressPercent = currentPending > 0 ? Math.min((totalPlanned / currentPending) * 100, 100) : 0;
                                
                                return (
                                    <div 
                                        key={project.id}
                                        draggable
                                        onDragStart={e => onDragStart(e, project)}
                                        className={`p-3 rounded-md cursor-grab transition-opacity ${isPlanned ? 'bg-gray-100 dark:bg-gray-700' : 'bg-light-bg dark:bg-dark-bg/50 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                    >
                                        <div className="flex items-start gap-2">
                                            {isPlanned && (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                            <p className="text-sm font-semibold flex-1" title={project.title}>{`#${project.id} - ${project.title}`}</p>
                                        </div>

                                        <div className="mt-2 space-y-2 pl-1">
                                            <div>
                                                <label htmlFor={`pending-${project.id}`} className="text-xs font-medium text-gray-500 dark:text-gray-400">H. Pendientes</label>
                                                <input 
                                                    id={`pending-${project.id}`}
                                                    type="number"
                                                    min="0"
                                                    value={currentPending}
                                                    onClick={e => e.stopPropagation()}
                                                    onMouseDown={e => e.stopPropagation()}
                                                    onChange={e => handlePendingHoursChange(project.id, e.target.value)}
                                                    className="mt-1 w-full text-sm p-1 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                                />
                                            </div>
                                            {isPlanned && (
                                                <div>
                                                    <div className={`flex justify-between items-center text-xs font-medium ${isOverPlanned ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'}`}>
                                                        <span>Planificado</span>
                                                        <span className="font-bold">
                                                            {totalPlanned}h / {currentPending}h
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mt-1">
                                                        <div 
                                                            className={`h-1.5 rounded-full transition-all duration-300 ${isOverPlanned ? 'bg-red-500' : 'bg-green-500'}`}
                                                            style={{ width: `${progressPercent}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Weekly Planner */}
                    <div className="lg:w-2/3 flex-1 overflow-x-auto pb-4">
                        <div className="flex gap-4 h-full">
                            {weeksToRender.map(weekIndex => {
                                const weekData = plan.find(w => w.weekIndex === weekIndex);
                                const totalHours = weekData ? weekData.projects.reduce((sum, p) => sum + p.assignedHours, 0) : 0;
                                const { startDate, endDate } = getWeekDateRange(weekIndex);
                                return (
                                    <div
                                        key={weekIndex}
                                        onDrop={e => onDrop(e, weekIndex)}
                                        onDragOver={e => onDragOver(e, weekIndex)}
                                        onDragLeave={onDragLeave}
                                        className={`w-72 flex-shrink-0 bg-light-card dark:bg-dark-card p-3 rounded-lg shadow-md flex flex-col transition-colors duration-200 ${draggedOverWeek === weekIndex ? 'bg-blue-100 dark:bg-blue-900/50' : ''}`}
                                    >
                                        <h3 className="font-semibold mb-2">Semana {weekIndex + 1} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">({formatDate(startDate)} - {formatDate(endDate)})</span></h3>
                                        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                                            {weekData?.projects.map(project => (
                                                <div key={project.id} className="p-2 bg-light-bg dark:bg-dark-bg/50 rounded-md group">
                                                    <div className="flex justify-between items-start">
                                                        <p className="text-sm truncate pr-2" title={project.title}>{project.title}</p>
                                                        <button onClick={() => removeProjectFromWeek(weekIndex, project.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <input type="number" min="0" value={project.assignedHours} onChange={e => handleHoursChange(weekIndex, project.id, e.target.value)} className="w-20 text-center px-2 py-1 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-primary" />
                                                        <span className="text-sm">horas</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!weekData || weekData.projects.length === 0) && <p className="text-xs text-center text-gray-400 py-4">Arrastra un proyecto aquí</p>}
                                        </div>
                                        <div className="mt-auto pt-2">
                                            <div className="flex justify-between items-center mb-1 text-xs">
                                                <span className="font-semibold">Carga Total</span>
                                                <span className={`font-bold ${totalHours > 40 ? 'text-orange-500' : ''}`}>{totalHours}h</span>
                                            </div>
                                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                <div className={`h-2 rounded-full ${totalHours > 40 ? 'bg-orange-500' : 'bg-green-500'}`} style={{ width: `${Math.min((totalHours / 40) * 100, 100)}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                             <div className="w-72 flex-shrink-0 flex items-center justify-center">
                                <button onClick={handleAddWeek} className="w-full h-full bg-light-card dark:bg-dark-card border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-brand-primary hover:text-brand-primary transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                    Agregar Semana
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};