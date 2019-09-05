const moment = require("moment");
const request = require("superagent");
require("dotenv").config();

const config = require("./config.js");
const { exitOnAsyncError } = require("./utils.js");

const getAttendeeCountsByStartDate = surveyResults => {
    const datesByCountry = {};
    // for each partner, identify valid two-date pairs and then increment 
        // dates by country with the start date
    surveyResults.partners.forEach(partner => {
        // initialize the country object if needed
        if (!datesByCountry[partner.country]) {
            datesByCountry[partner.country] = {}
        }

        // all seem to be sorted, but just in case...
        let sortedDates = partner.availableDates.sort();

        let day1 = sortedDates[0];
        sortedDates.slice(1).forEach(date => {
            // if this date is exactly one day after a previous offered date
            if (moment(day1).add(1, "day").isSame(moment(date))) {
                // initialize startDate object if needed
                if (!datesByCountry[partner.country][day1]) {
                    datesByCountry[partner.country][day1] = {
                        count: 0,
                        attendees: []
                    }
                }
                datesByCountry[partner.country][day1].count ++;
                datesByCountry[partner.country][day1].attendees.push(partner.email);
            }
            day1 = date;
        });
    });
    return datesByCountry;
}

const getInvitationDates = datesByCountry => {
    const invitationJSON = {
        "countries": []
    }

    // for each country, find the date with the most potential attendees, 
        // then format the POST json for that country -> startDate
    Object.keys(datesByCountry).forEach(country => {
        let bestStartDate = null;
        let highestCount = 0;
        let attendees = [];

        // reigning champion-style max algorithm
        Object.keys(datesByCountry[country]).forEach(startDate => {
            thisCount = datesByCountry[country][startDate].count
            // tie goes to the earlier date
            if (thisCount == highestCount) {
                if (moment(startDate).isBefore(moment(bestStartDate))) {
                    highestCount = thisCount
                    bestStartDate = startDate
                    attendees = datesByCountry[country][startDate].attendees    
                }
            }
            else if (thisCount > highestCount) {
                highestCount = thisCount
                bestStartDate = startDate
                attendees = datesByCountry[country][startDate].attendees
            }

        });

        invitationJSON.countries.push(
            {
                attendeeCount: highestCount,
                attendees: attendees,
                name: country,
                startDate: bestStartDate,
            }
        );
    });
    return invitationJSON;
}
     
const fetchSurveyResults = async () => 
    request.get(
        `${config.hubspotHost}/${config.survey_endpoint}`
        )
        .query({
            userKey: process.env.USER_KEY
        });        
 
const postInvitationDates = async invitationJSON =>  request.post(
            `${config.hubspotHost}/${config.post_dates_endpoint}`
            )
            .query({
                userKey: process.env.USER_KEY
            })
            .send(invitationJSON);

const run = async () => {
    // get the survey results
    let surveyResultsResponse = await exitOnAsyncError(fetchSurveyResults());

    // count potential attendees for each start date within each country 
    const datesByCountry = getAttendeeCountsByStartDate(surveyResultsResponse.body);

    // get the max of each of those attendee counts and write the 
        // requisite data to our final json object
    const invitationJSON = getInvitationDates(datesByCountry);
    const result = await exitOnAsyncError(postInvitationDates(invitationJSON));

    return result
}

run()