import { IPrecision } from "../libs/stats/statsCounters";
import { IStatsActivePeriod } from "../Models/Stats/StatsConfig";
import { calculCoefActivationByPrecision } from "../libs/stats/exportStatsInCsv";

describe("Tests coef active periods calcul on hours", () => {
    let precision: IPrecision;
    let periodIndex: null|number;
    let activePeriods: IStatsActivePeriod[];

    beforeAll(() => {
        precision = "hour";
        periodIndex = null;
        activePeriods = [
            {
                startDate: new Date("2023-04-16Z12:25:00")
            },
            {
                startDate: new Date("2023-04-16Z11:10:00"),
                endDate: new Date("2023-04-16Z11:50:00")
            },
            {
                startDate: new Date("2023-04-16Z10:30:00"),
                endDate: new Date("2023-04-16Z10:55:00")
            },
            {
                startDate: new Date("2023-04-16Z10:05:00"),
                endDate: new Date("2023-04-16Z10:12:00")
            }
        ]
    })

    test("Test 1 on hours", () => {
        const startDate = new Date("2023-04-16Z13:00:00");
        
        const {periodIndex: newPeriodIndex, coef} = calculCoefActivationByPrecision(startDate, precision, periodIndex, activePeriods);

        expect(coef).toEqual(1);
        expect(newPeriodIndex).toEqual(0);

        periodIndex = newPeriodIndex;
    });

    test("Test 2 on hours", () => {
        const startDate = new Date("2023-04-16Z12:00:00");
        
        const {periodIndex: newPeriodIndex, coef} = calculCoefActivationByPrecision(startDate, precision, periodIndex, activePeriods);

        expect(coef).toEqual(35/60);
        expect(newPeriodIndex).toEqual(0);

        periodIndex = newPeriodIndex;
    })

    test("Test 3 on hours", () => {
        const startDate = new Date("2023-04-16Z11:00:00");
        
        const {periodIndex: newPeriodIndex, coef} = calculCoefActivationByPrecision(startDate, precision, periodIndex, activePeriods);

        expect(coef).toEqual(40/60);
        expect(newPeriodIndex).toEqual(1);

        periodIndex = newPeriodIndex;
    })

    test("Test 4 on hours", () => {
        const startDate = new Date("2023-04-16Z10:00:00");
        
        const {periodIndex: newPeriodIndex, coef} = calculCoefActivationByPrecision(startDate, precision, periodIndex, activePeriods);

        expect(coef).toEqual(32/60);
        expect(newPeriodIndex).toEqual(2);

        periodIndex = newPeriodIndex;
    })

    test("Test 5 on hours", () => {
        const startDate = new Date("2023-04-16Z09:00:00");
        
        const {periodIndex: newPeriodIndex, coef} = calculCoefActivationByPrecision(startDate, precision, periodIndex, activePeriods);

        expect(coef).toEqual(0);
        expect(newPeriodIndex).toEqual(3);

        periodIndex = newPeriodIndex;
    })
})

describe("Tests coef active periods calcul on days", () => {
    let precision: IPrecision;
    let periodIndex: null|number;
    let activePeriods: IStatsActivePeriod[];

    beforeAll(() => {
        precision = "day";
        periodIndex = null;
        activePeriods = [
            {
                startDate: new Date("2023-04-14Z08:00:00")
            },
            {
                startDate: new Date("2023-04-12Z23:00:00"),
                endDate: new Date("2023-04-13Z07:38:00")
            },
            {
                startDate: new Date("2023-04-12Z18:32:00"),
                endDate: new Date("2023-04-12Z22:38:17")
            },
            {
                startDate: new Date("2023-04-12Z02:05:00"),
                endDate: new Date("2023-04-12Z07:12:00")
            }
        ]
    })

    test("Test 1 on days", () => {
        const startDate = new Date("2023-04-15");
        
        const {periodIndex: newPeriodIndex, coef} = calculCoefActivationByPrecision(startDate, precision, periodIndex, activePeriods);

        expect(coef).toEqual(1);
        expect(newPeriodIndex).toEqual(0);

        periodIndex = newPeriodIndex;
    });

    test("Test 2 on days", () => {
        const startDate = new Date("2023-04-14");
        
        const {periodIndex: newPeriodIndex, coef} = calculCoefActivationByPrecision(startDate, precision, periodIndex, activePeriods);



        expect(coef).toEqual(16/24);
        expect(newPeriodIndex).toEqual(0);

        periodIndex = newPeriodIndex;
    })

    test("Test 3 on days", () => {
        const startDate = new Date("2023-04-13");
        
        const {periodIndex: newPeriodIndex, coef} = calculCoefActivationByPrecision(startDate, precision, periodIndex, activePeriods);

        expect(coef).toEqual((7*60+38)/(24*60));
        expect(newPeriodIndex).toEqual(1);

        periodIndex = newPeriodIndex;
    })

    test("Test 4 on days", () => {
        const startDate = new Date("2023-04-12");
        
        const {periodIndex: newPeriodIndex, coef} = calculCoefActivationByPrecision(startDate, precision, periodIndex, activePeriods);

        expect(coef).toEqual((3600+( (22*3600+38*60+17) - (18*3600+32*60) ) + ((7*3600+12*60)-(2*3600+5*60))) / (24*3600));
        expect(newPeriodIndex).toEqual(1);

        periodIndex = newPeriodIndex;
    })

    test("Test 5 on days", () => {
        const startDate = new Date("2023-04-11");
        
        const {periodIndex: newPeriodIndex, coef} = calculCoefActivationByPrecision(startDate, precision, periodIndex, activePeriods);

        expect(coef).toEqual(0);
        expect(newPeriodIndex).toEqual(3);

        periodIndex = newPeriodIndex;
    })
})
