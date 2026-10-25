declare module "word-extractor" {
  type WordDocument = {
    getBody(): string;
    getFootnotes(): string;
    getEndnotes(): string;
  };

  export default class WordExtractor {
    extract(source: string | Buffer): Promise<WordDocument>;
  }
}
