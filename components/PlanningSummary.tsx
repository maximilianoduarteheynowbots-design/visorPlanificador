
import React, { useMemo, useCallback } from 'react';
import { SimpleBarChart } from './SimpleBarChart';

interface CalculatedWeek {
    weekIndex: number;
    startDate: string;
    endDate: string;
    projects: {
        id: number;
        title: string;
        assignedHours: number;
    }[];
    totalHours: number;
}

interface PlanningSummaryProps {
    plan: CalculatedWeek[];
    developer: string;
    onBackToPlanner: () => void;
    projectHoursMap: Map<number, number>;
}

const SummaryCard: React.FC<{ title: string; value: string | number; }> = ({ title, value }) => (
    <div className="p-4 bg-light-bg dark:bg-dark-bg/50 rounded-lg text-center h-full flex flex-col justify-center">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-3xl font-bold mt-1 text-gray-800 dark:text-gray-200">{value}</p>
    </div>
);

const projectColors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1', '#D946EF', '#F97316'];
const getProjectColor = (index: number) => projectColors[index % projectColors.length];


export const PlanningSummary: React.FC<PlanningSummaryProps> = ({ plan, developer, onBackToPlanner, projectHoursMap }) => {

    const summaryMetrics = useMemo(() => {
        const totalWeeks = plan.length;
        const totalOvertime = plan.reduce((sum, week) => sum + Math.max(0, week.totalHours - 40), 0);
        const finalProjectDate = plan.length > 0 ? plan[plan.length - 1].endDate : 'N/A';
        return { totalWeeks, totalOvertime, finalProjectDate };
    }, [plan]);

    const projectSummary = useMemo(() => {
        const projects = new Map<number, { title: string; planned: number }>();

        plan.forEach(week => {
            week.projects.forEach(p => {
                const current = projects.get(p.id) || { title: p.title, planned: 0 };
                projects.set(p.id, {
                    ...current,
                    planned: current.planned + p.assignedHours,
                });
            });
        });

        return Array.from(projects.entries())
            .map(([id, data]) => {
                const initialPending = projectHoursMap.get(id) ?? 0;
                const remaining = initialPending - data.planned;
                return {
                    id,
                    title: data.title,
                    initialPending,
                    planned: data.planned,
                    remaining,
                };
            })
            .sort((a, b) => a.title.localeCompare(b.title));
    }, [plan, projectHoursMap]);

    const chartData = useMemo(() => plan.map(week => ({
        label: `Sem. ${week.weekIndex + 1} (${week.startDate})`,
        value: week.totalHours,
        color: week.totalHours > 40 ? '#F97316' : '#22C55E',
    })), [plan]);

    const handleDownload = useCallback(() => {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += `Planificacion Semanal para ${developer}\n\n`;
        
        const headers = ['Semana', 'Fecha de Inicio', 'Fecha de Fin', 'ID Proyecto', 'Titulo Proyecto', 'Horas Asignadas'];
        csvContent += headers.join(',') + '\n';

        plan.forEach(week => {
            week.projects.forEach(project => {
                const row = [
                    week.weekIndex + 1,
                    week.startDate,
                    week.endDate,
                    project.id,
                    `"${project.title.replace(/"/g, '""')}"`,
                    project.assignedHours
                ];
                csvContent += row.join(',') + '\n';
            });
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        const safeDevName = developer.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.setAttribute("download", `planificacion_${safeDevName}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [plan, developer]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Resumen de Planificación: <span className="text-brand-primary">{developer}</span></h2>
                <div className="flex gap-2">
                    <button onClick={onBackToPlanner} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">Volver a Planificar</button>
                    <button onClick={handleDownload} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Descargar Planificación</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SummaryCard title="Semanas Planificadas" value={summaryMetrics.totalWeeks} />
                <SummaryCard title="Total Horas Extra" value={`${summaryMetrics.totalOvertime}h`} />
                <SummaryCard title="Finalización del Último Proyecto" value={summaryMetrics.finalProjectDate} />
            </div>
            
            <div className="p-4 bg-light-card dark:bg-dark-card rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100">Resumen por Proyecto</h3>
                <div className="max-h-96 overflow-y-auto pr-2">
                    <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-light-card dark:bg-dark-card border-b-2 border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="p-2">Proyecto</th>
                                <th className="p-2 text-center">H. Pendientes (Inicial)</th>
                                <th className="p-2 text-center">H. Planificadas</th>
                                <th className="p-2 text-center">H. Restantes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {projectSummary.map(proj => (
                                <tr key={proj.id} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-light-bg dark:hover:bg-dark-bg/50">
                                    <td className="p-2 font-medium truncate" title={proj.title}>{`#${proj.id} - ${proj.title}`}</td>
                                    <td className="p-2 text-center">{proj.initialPending}h</td>
                                    <td className="p-2 text-center">{proj.planned}h</td>
                                    <td className={`p-2 text-center font-bold ${proj.remaining < 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                                        {proj.remaining}h
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-4 bg-light-card dark:bg-dark-card rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold mb-3">Carga de Trabajo Semanal</h3>
                    <div className="h-96">
                        <SimpleBarChart data={chartData} />
                    </div>
                </div>
                <div className="p-4 bg-light-card dark:bg-dark-card rounded-lg shadow-md">
                     <h3 className="text-lg font-semibold mb-3">Cronograma de Proyectos</h3>
                     <div className="space-y-2 text-sm max-h-96 overflow-y-auto pr-2">
                        {plan.map(week => (
                            <div key={week.weekIndex}>
                                <p className="font-semibold text-gray-700 dark:text-gray-300">Sem. {week.weekIndex + 1} <span className="font-normal text-xs text-gray-500">({week.startDate})</span></p>
                                <div className="pl-4 border-l-2 border-gray-200 dark:border-gray-700 ml-1">
                                    {week.projects.map((project, pIndex) => (
                                        <div key={project.id} className="flex items-center gap-2 py-1">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getProjectColor(project.id) }}></div>
                                            <p className="flex-1 truncate" title={project.title}>{project.title}</p>
                                            <p className="font-mono text-xs p-1 bg-light-bg dark:bg-dark-bg/50 rounded">{project.assignedHours}h</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                     </div>
                </div>
            </div>
        </div>
    );
};