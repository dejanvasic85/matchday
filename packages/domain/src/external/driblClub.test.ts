import { driblClubSocialSchema } from "./driblClub.ts";

describe("driblClubSocialSchema", () => {
  it("accepts a known platform name", () => {
    const result = driblClubSocialSchema.safeParse({
      name: "facebook",
      value: "https://facebook.com/altonanorth",
    });

    expect(result.success).toBe(true);
  });

  it("tolerates a platform name Dribl hasn't sent before", () => {
    const result = driblClubSocialSchema.safeParse({
      name: "tiktok",
      value: "https://tiktok.com/@altonanorth",
    });

    expect(result.success).toBe(true);
  });
});
