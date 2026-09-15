import { Request, Response, sql } from "@elements/app";
import html from "./template";

export default function route(req: Request, res: Response) {
  return new html();
}
