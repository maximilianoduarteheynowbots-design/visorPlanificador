import React, { useState, useEffect } from 'react';

interface PatInputProps {
    onSubmit: (details: { pat: string, orgName: string, projectName: string, rememberMe: boolean }) => void;
    isLoading: boolean;
    error: string | null;
}

export const PatInput: React.FC<PatInputProps> = ({ onSubmit, isLoading, error }) => {
    const [pat, setPat] = useState('');
    const [orgName, setOrgName] = useState('');
    const [projectName, setProjectName] = useState('');
    const [rememberMe, setRememberMe] = useState(false);

    useEffect(() => {
        const savedData = localStorage.getItem('azureDevOpsCreds');
        if (savedData) {
            try {
                const { pat, orgName, projectName } = JSON.parse(savedData);
                setPat(pat || '');
                setOrgName(orgName || '');
                setProjectName(projectName || '');
                setRememberMe(true);
            } catch (e) {
                console.error("Failed to parse saved credentials", e);
                localStorage.removeItem('azureDevOpsCreds');
            }
        }
    }, []);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pat.trim() && orgName.trim() && projectName.trim()) {
            onSubmit({ 
                pat: pat.trim(), 
                orgName: orgName.trim(),
                projectName: projectName.trim(), 
                rememberMe 
            });
        }
    };
    
    const isFormValid = pat.trim() && orgName.trim() && projectName.trim();

    return (
        <div className="max-w-lg mx-auto mt-10 p-6 bg-light-card dark:bg-dark-card rounded-xl shadow-lg animate-fade-in">
            <h2 className="text-xl font-semibold mb-4 text-center">Conectar a Azure DevOps</h2>
            <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-6">
                Ingresa los datos de tu organización y un Token de Acceso Personal (PAT) para cargar los elementos de trabajo del proyecto.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="org-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Organización</label>
                    <input
                        id="org-name"
                        type="text"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        className="mt-1 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        placeholder="su-organizacion"
                        disabled={isLoading}
                        required
                    />
                </div>
                 <div>
                    <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre del Proyecto</label>
                    <input
                        id="project-name"
                        type="text"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        className="mt-1 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        placeholder="MiProyecto"
                        disabled={isLoading}
                        required
                    />
                </div>
                <div>
                    <label htmlFor="pat-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Token de Acceso Personal (PAT)</label>
                    <input
                        id="pat-input"
                        type="password"
                        value={pat}
                        onChange={(e) => setPat(e.target.value)}
                        className="mt-1 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        placeholder="Ingresa tu PAT aquí"
                        disabled={isLoading}
                        required
                    />
                </div>
                 <div className="flex items-center">
                    <input
                        id="remember-me"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-secondary"
                        disabled={isLoading}
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                        Recordar datos
                    </label>
                </div>
                <button
                    type="submit"
                    className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                    disabled={isLoading || !isFormValid}
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Conectando...
                        </>
                    ) : (
                        'Cargar Tareas del Proyecto'
                    )}
                </button>
            </form>
            {error && (
                <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg text-sm">
                    <strong>Error:</strong> {error}
                </div>
            )}
        </div>
    );
};