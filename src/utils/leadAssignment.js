const assignLeadsToEmployees = async (leads, employees) => {
    
    if (!employees || employees.length === 0) {
        return {
            success: false,
            message: 'No employees available',
            assignments: leads.map(lead => ({
                leadId: lead._id,
                assignedTo: null,
                reason: 'No employees available'
            }))
        };
    }

    const assignments = [];

    
    for (const lead of leads) {
        let assigned = false;
        
        
        for (const employee of employees) {
            const locationMatch = employee.location && 
                                lead.location && 
                                employee.location.toLowerCase() === lead.location.toLowerCase();
            
            const languageMatch = employee.languages && 
                                lead.language && 
                                employee.languages.toLowerCase() === lead.language.toLowerCase();
            
            if (locationMatch || languageMatch) {
                assignments.push({
                    leadId: lead._id,
                    assignedTo: employee._id,
                    employeeName: `${employee.firstName} ${employee.lastName}`,
                    reason: locationMatch ? 'Location match' : 'Language match'
                });
                assigned = true;
                break; 
            }
        }

       
        if (!assigned) {
            assignments.push({
                leadId: lead._id,
                assignedTo: null,
                employeeName: null,
                reason: 'No location or language match'
            });
        }
    }

    return {
        success: true,
        assignments,
        summary: {
            total: leads.length,
            assigned: assignments.filter(a => a.assignedTo !== null).length,
            unassigned: assignments.filter(a => a.assignedTo === null).length
        }
    };
};


const assignUnassignedLeadsToNewEmployee = async (employee, unassignedLeads) => {
    if (!unassignedLeads || unassignedLeads.length === 0) {
        return {
            success: true,
            message: 'No unassigned leads to process',
            assignments: [],
            summary: {
                totalUnassigned: 0,
                newlyAssigned: 0,
                stillUnassigned: 0
            }
        };
    }

    const assignments = [];
    const stillUnassignedLeads = [];

    for (const lead of unassignedLeads) {
        const locationMatch = employee.location && 
                            lead.location && 
                            employee.location.toLowerCase() === lead.location.toLowerCase();
        
        const languageMatch = employee.languages && 
                            lead.language && 
                            employee.languages.toLowerCase() === lead.language.toLowerCase();

        if (locationMatch || languageMatch) {
            assignments.push({
                leadId: lead._id,
                leadName: lead.name,
                assignedTo: employee._id,
                employeeName: `${employee.firstName} ${employee.lastName}`,
                reason: locationMatch && languageMatch ? 'Location and Language match' :
                        locationMatch ? 'Location match' : 'Language match'
            });
        } else {
            stillUnassignedLeads.push({
                leadId: lead._id,
                leadName: lead.name,
                location: lead.location,
                language: lead.language
            });
        }
    }

    return {
        success: true,
        assignments,
        stillUnassignedLeads, 
        summary: {
            totalUnassigned: unassignedLeads.length,
            newlyAssigned: assignments.length,
            stillUnassigned: unassignedLeads.length - assignments.length
        }
    };
};


const reassignLeadsOnEmployeeDeletion = async (deletedEmployeeLeads, activeEmployees) => {

    if (!activeEmployees || activeEmployees.length === 0) {
        return {
            success: true,
            assignments: deletedEmployeeLeads.map(lead => ({
                leadId: lead._id,
                assignedTo: null,
                reason: 'No active employees available'
            })),
            summary: {
                totalLeads: deletedEmployeeLeads.length,
                reassigned: 0,
                unassigned: deletedEmployeeLeads.length
            }
        };
    }

    if (!deletedEmployeeLeads || deletedEmployeeLeads.length === 0) {
        return {
            success: true,
            assignments: [],
            summary: {
                totalLeads: 0,
                reassigned: 0,
                unassigned: 0
            }
        };
    }

    const assignments = [];
    const numLeads = deletedEmployeeLeads.length;
    const numEmployees = activeEmployees.length;


    if (numEmployees >= numLeads) {
     
        deletedEmployeeLeads.forEach((lead, index) => {
            assignments.push({
                leadId: lead._id,
                assignedTo: activeEmployees[index]._id,
                employeeName: `${activeEmployees[index].firstName} ${activeEmployees[index].lastName}`,
                reason: 'Equal distribution after deletion'
            });
        });
    } 

    else {
        const leadsPerEmployee = Math.floor(numLeads / numEmployees);
        const remainder = numLeads % numEmployees;
        
        let leadIndex = 0;
        
 
        for (let empIndex = 0; empIndex < numEmployees; empIndex++) {
            for (let i = 0; i < leadsPerEmployee; i++) {
                assignments.push({
                    leadId: deletedEmployeeLeads[leadIndex]._id,
                    assignedTo: activeEmployees[empIndex]._id,
                    employeeName: `${activeEmployees[empIndex].firstName} ${activeEmployees[empIndex].lastName}`,
                    reason: 'Equal distribution after deletion'
                });
                leadIndex++;
            }
        }
        

        while (leadIndex < numLeads) {
            assignments.push({
                leadId: deletedEmployeeLeads[leadIndex]._id,
                assignedTo: null,
                employeeName: null,
                reason: 'Remainder after equal distribution - unassigned'
            });
            leadIndex++;
        }
    }

    return {
        success: true,
        assignments,
        summary: {
            totalLeads: numLeads,
            reassigned: assignments.filter(a => a.assignedTo !== null).length,
            unassigned: assignments.filter(a => a.assignedTo === null).length
        }
    };
};

module.exports = {
    assignLeadsToEmployees,
    assignUnassignedLeadsToNewEmployee,
    reassignLeadsOnEmployeeDeletion
};