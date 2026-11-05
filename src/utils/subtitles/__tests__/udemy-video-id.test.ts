import { describe, expect, it } from "vitest"
import { getUdemyLectureIdFromUrl } from "../video-id/udemy"

describe("getUdemyLectureIdFromUrl", () => {
  it("names the course and lecture a course player is on", () => {
    expect(
      getUdemyLectureIdFromUrl(
        "https://www.udemy.com/course/object-oriented-python-programming/learn/lecture/18241902#overview",
      ),
    ).toBe("object-oriented-python-programming/18241902")
  })

  it("reads a Udemy Business lecture on a company subdomain", () => {
    expect(
      getUdemyLectureIdFromUrl(
        "https://acme.udemy.com/course/python-basics/learn/lecture/42/?start=0",
      ),
    ).toBe("python-basics/42")
  })

  it("ignores pages that are not a lecture", () => {
    expect(getUdemyLectureIdFromUrl("https://www.udemy.com/course/python-basics/")).toBeNull()
    expect(
      getUdemyLectureIdFromUrl("https://www.udemy.com/course/python-basics/learn/quiz/7"),
    ).toBeNull()
    expect(getUdemyLectureIdFromUrl("https://www.udemy.com/home/my-courses/learning/")).toBeNull()
    expect(getUdemyLectureIdFromUrl("not a url")).toBeNull()
  })
})
