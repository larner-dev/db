import { db } from "./db";
describe("db", () => {
	test("constructor", async () => {
		expect(db).toBeDefined();
	});
});
