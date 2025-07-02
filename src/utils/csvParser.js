const parseLeadCSV = (csvData) => {
    const validatedLeads = [];
    const errors = [];
    
    csvData.forEach((row, index) => {

        const cleanRow = {};
        Object.keys(row).forEach(key => {
            const cleanKey = key.trim().replace(/^\uFEFF/, ''); 
            cleanRow[cleanKey] = row[key] ? row[key].trim() : '';
        });
        
   
        if (!cleanRow.name || !cleanRow.email) {
            errors.push({
                row: index + 2,
                message: 'Name and email are required',
                data: cleanRow
            });
            return;
        }
        
      
        const lead = {
            name: cleanRow.name,
            email: cleanRow.email.toLowerCase(),
            phone: cleanRow.phone || '',
            receivedDate: cleanRow.receivedDate ? new Date(cleanRow.receivedDate) : new Date(),
            location: cleanRow.location || '',
            language: cleanRow.language || '',
            status: cleanRow.status && ['hot', 'cold', 'warm'].includes(cleanRow.status.toLowerCase()) 
                     ? cleanRow.status.toLowerCase() 
                     : 'warm',
            leadStatus: cleanRow.leadStatus || 'open',
            callType: cleanRow.callType || 'cold_call'
        };
        

        if (!isValidEmail(lead.email)) {
            errors.push({
                row: index + 2,
                message: 'Invalid email format',
                data: cleanRow
            });
            return;
        }
        
        if (lead.phone && !isValidPhone(lead.phone)) {
            errors.push({
                row: index + 2,
                message: 'Invalid phone format',
                data: cleanRow
            });
            return;
        }
        
        validatedLeads.push(lead);
    });
    
    return {
        success: errors.length === 0,
        leads: validatedLeads,
        errors,
        summary: {
            total: csvData.length,
            valid: validatedLeads.length,
            invalid: errors.length
        }
    };
};


const validateLeadData = (leadData) => {
    const errors = [];
    
    if (!leadData.name || leadData.name.trim() === '') {
        errors.push('Name is required');
    }
    
    if (!leadData.email || !isValidEmail(leadData.email)) {
        errors.push('Valid email is required');
    }
    
    if (leadData.phone && !isValidPhone(leadData.phone)) {
        errors.push('Invalid phone format');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};


const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const isValidPhone = (phone) => {
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{4,6}$/;
    return phoneRegex.test(phone);
};

module.exports = {
    parseLeadCSV,
    validateLeadData
};