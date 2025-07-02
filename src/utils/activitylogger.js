const logActivity = async (ActivityLog, activityData) => {
    try {
        const activity = new ActivityLog({
            action: activityData.action,
            performedBy: activityData.performedBy,
            performerModel: activityData.performerModel || 'Admin',
            targetId: activityData.targetId,
            targetType: activityData.targetType,
            previousData: activityData.previousData || {},
            newData: activityData.newData || {},
            timestamp: new Date()
        });


         if (activityData.employeeDetails) {
            activity.employeeDetails = activityData.employeeDetails;
        }


            if (activityData.leadDetails) {
            activity.leadDetails = activityData.leadDetails;
            }


            if (activityData.metadata) {
            activity.metadata = activityData.metadata;
            }
        await activity.save();
        return activity;
    } catch (error) {
        console.error('Activity logging failed:', error);
        
    }
};

const ACTIVITY_TYPES = {

    LEAD_ASSIGNED: 'lead_assigned',
    LEAD_CLOSED: 'lead_closed',

    

    EMPLOYEE_LOGIN: 'employee_login',
    EMPLOYEE_LOGOUT: 'employee_logout',
    


};

module.exports = {
    logActivity,
    ACTIVITY_TYPES
};