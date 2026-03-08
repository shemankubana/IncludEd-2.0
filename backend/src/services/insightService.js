import axios from 'axios';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Service to generate AI-driven insights for teachers using Gemini.
 */
export async function generateTeacherInsights(analyticsData) {
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/teacher/insights`, {
            analytics_data: analyticsData,
        });
        return response.data.insights;
    } catch (error) {
        console.error('Insight generation error:', error);
        return 'Could not generate AI insights at this time.';
    }
}
