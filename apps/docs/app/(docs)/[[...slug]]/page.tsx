import type { Metadata } from "next";

import { notFound } from "next/navigation";

import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";

import { publicPaths } from "@/lib/site";
import { source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";

type PageProps = { params: Promise<{ slug?: string[] }> };

export const generateStaticParams = () => source.generateParams();

export const generateMetadata = async ({
  params,
}: PageProps): Promise<Metadata> => {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const url = publicPaths.url(page.url);
  // The root layout templates page titles as "%s · magic". The home page is
  // already called magic, so it opts out instead of reading "magic · magic".
  const title = slug?.length ? page.data.title : { absolute: page.data.title };

  return {
    title,
    description: page.data.description,
    alternates: { canonical: url },
    openGraph: {
      url,
      title: page.data.title,
      description: page.data.description,
    },
  };
};

const Page = async ({ params }: PageProps) => {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const Mdx = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <Mdx components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
};

export default Page;
