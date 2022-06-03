/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import type { RenderResult } from "@testing-library/react";
import type { ApplicationBuilder } from "../../renderer/components/test-utils/get-application-builder";
import { getApplicationBuilder } from "../../renderer/components/test-utils/get-application-builder";
import type { ReadYamlFile } from "../../common/fs/read-yaml-file.injectable";
import readYamlFileInjectable from "../../common/fs/read-yaml-file.injectable";
import type { AsyncFnMock } from "@async-fn/jest";
import asyncFn from "@async-fn/jest";
import type { HelmRepositoriesFromYaml } from "../../main/helm/repositories/get-active-helm-repositories/get-active-helm-repositories.injectable";
import execFileInjectable from "../../common/fs/exec-file.injectable";
import helmBinaryPathInjectable from "../../main/helm/helm-binary-path.injectable";
import loggerInjectable from "../../common/logger.injectable";
import type { Logger } from "../../common/logger";

describe("listing active helm repositories in preferences", () => {
  let applicationBuilder: ApplicationBuilder;
  let rendered: RenderResult;
  let readYamlFileMock: AsyncFnMock<ReadYamlFile>;
  let execFileMock: AsyncFnMock<ReturnType<typeof execFileInjectable["instantiate"]>>;
  let loggerStub: Logger;

  beforeEach(async () => {
    applicationBuilder = getApplicationBuilder();

    readYamlFileMock = asyncFn();
    execFileMock = asyncFn();

    loggerStub = { warn: jest.fn() } as unknown as Logger;

    applicationBuilder.beforeApplicationStart(({ mainDi }) => {
      mainDi.override(readYamlFileInjectable, () => readYamlFileMock);
      mainDi.override(execFileInjectable, () => execFileMock);
      mainDi.override(helmBinaryPathInjectable, () => "some-helm-binary-path");
      mainDi.override(loggerInjectable, () => loggerStub);
    });

    rendered = await applicationBuilder.render();
  });

  describe("when navigating to preferences containing helm repositories", () => {
    beforeEach(async () => {
      applicationBuilder.preferences.navigate();
      applicationBuilder.preferences.navigation.click("kubernetes");
    });

    it("renders", () => {
      expect(rendered.baseElement).toMatchSnapshot();
    });

    it("shows loader for repositories", () => {
      expect(
        rendered.getByTestId("helm-repositories-are-loading"),
      ).toBeInTheDocument();
    });

    it("calls for helm configuration", () => {
      expect(execFileMock).toHaveBeenCalledWith(
        "some-helm-binary-path",
        ["env"],
      );
    });

    it("does not call for updating of repositories yet", () => {
      expect(execFileMock).not.toHaveBeenCalledWith(
        "some-helm-binary-path",
        ["repo", "update"],
      );
    });

    describe("when configuration resolves without path to repository config file", () => {
      beforeEach(async () => {
        execFileMock.mockClear();

        await execFileMock.resolveSpecific(
          ["some-helm-binary-path", ["env"]],
          "HELM_REPOSITORY_CACHE=some-helm-repository-cache-path",
        );
      });

      it("renders", () => {
        expect(rendered.baseElement).toMatchSnapshot();
      });

      it("logs error", () => {
        expect(loggerStub.warn).toHaveBeenCalledWith(
          "Tried to get Helm repositories, but HELM_REPOSITORY_CONFIG was not present in `$ helm env`. Behaving as if there were no repositories.",
        );
      });

      it("shows message about no repositories found", () => {
        expect(
          rendered.getByTestId("no-helm-repositories"),
        ).toBeInTheDocument();
      });

      it("does not show loader for repositories anymore", () => {
        expect(
          rendered.queryByTestId("helm-repositories-are-loading"),
        ).not.toBeInTheDocument();
      });

      it("does not call for updating of repositories", () => {
        expect(execFileMock).not.toHaveBeenCalledWith(
          "some-helm-binary-path",
          ["repo", "update"],
        );
      });
    });

    describe("when configuration resolves without path to repository cache directory", () => {
      beforeEach(async () => {
        execFileMock.mockClear();

        await execFileMock.resolveSpecific(
          ["some-helm-binary-path", ["env"]],
          "HELM_REPOSITORY_CONFIG=some-helm-repository-config-file.yaml",
        );
      });

      it("renders", () => {
        expect(rendered.baseElement).toMatchSnapshot();
      });

      it("logs error", () => {
        expect(loggerStub.warn).toHaveBeenCalledWith(
          "Tried to get Helm repositories, but HELM_REPOSITORY_CACHE was not present in `$ helm env`. Behaving as if there were no repositories.",
        );
      });

      it("shows message about no repositories found", () => {
        expect(
          rendered.getByTestId("no-helm-repositories"),
        ).toBeInTheDocument();
      });

      it("does not show loader for repositories anymore", () => {
        expect(
          rendered.queryByTestId("helm-repositories-are-loading"),
        ).not.toBeInTheDocument();
      });

      it("does not call for updating of repositories", () => {
        expect(execFileMock).not.toHaveBeenCalledWith(
          "some-helm-binary-path",
          ["repo", "update"],
        );
      });
    });

    describe("when configuration resolves", () => {
      beforeEach(async () => {
        execFileMock.mockClear();

        await execFileMock.resolveSpecific(
          ["some-helm-binary-path", ["env"]],

          [
            "HELM_REPOSITORY_CONFIG=some-helm-repository-config-file.yaml",
            "HELM_REPOSITORY_CACHE=some-helm-repository-cache-path",
          ].join("\n"),
        );
      });

      it("renders", () => {
        expect(rendered.baseElement).toMatchSnapshot();
      });

      it("calls for update of repositories", () => {
        expect(execFileMock).toHaveBeenCalledWith(
          "some-helm-binary-path",
          ["repo", "update"],
        );
      });

      it("does not call for repositories yet", () => {
        expect(readYamlFileMock).not.toHaveBeenCalled();
      });

      describe("when updating repositories resolve", () => {
        beforeEach(async () => {
          execFileMock.mockClear();

          await execFileMock.resolveSpecific(
            ["some-helm-binary-path", ["repo", "update"]],
            "",
          );
        });

        describe("when loading repositories resolves with existing repositories", () => {
          beforeEach(async () => {
            execFileMock.mockClear();

            await readYamlFileMock.resolveSpecific(
              ["some-helm-repository-config-file.yaml"],
              repositoryConfigStub,
            );
          });

          it("does not add default repository", () => {
            expect(execFileMock).not.toHaveBeenCalledWith(
              "some-helm-binary-path",
              ["repo", "add", "bitnami", "https://charts.bitnami.com/bitnami"],
            );
          });

          it("renders", () => {
            expect(rendered.baseElement).toMatchSnapshot();
          });

          it("does not show loader for repositories anymore", () => {
            expect(
              rendered.queryByTestId("helm-repositories-are-loading"),
            ).not.toBeInTheDocument();
          });

          it("shows repositories in use", () => {
            const actual = rendered.getAllByTestId(
              /^helm-repository-(some-repository|some-other-repository)$/,
            );

            expect(actual).toHaveLength(2);
          });
        });

        describe("when loading repositories resolves with no existing repositories", () => {
          beforeEach(async () => {
            execFileMock.mockClear();

            await readYamlFileMock.resolveSpecific(
              ["some-helm-repository-config-file.yaml"],
              { repositories: [] },
            );
          });

          it("renders", () => {
            expect(rendered.baseElement).toMatchSnapshot();
          });

          it("still shows the loader for repositories", () => {
            expect(
              rendered.queryByTestId("helm-repositories-are-loading"),
            ).toBeInTheDocument();
          });

          it("does not show message about no repositories", () => {
            expect(
              rendered.queryByTestId("no-helm-repositories"),
            ).not.toBeInTheDocument();
          });

          it('adds "bitnami" as default repository', () => {
            expect(execFileMock).toHaveBeenCalledWith(
              "some-helm-binary-path",
              ["repo", "add", "bitnami", "https://charts.bitnami.com/bitnami"],
            );
          });

          describe("when adding of default repository resolves", () => {
            beforeEach(async () => {
              readYamlFileMock.mockClear();

              await execFileMock.resolveSpecific(
                [
                  "some-helm-binary-path",

                  [
                    "repo",
                    "add",
                    "bitnami",
                    "https://charts.bitnami.com/bitnami",
                  ],
                ],

                "",
              );
            });

            it("renders", () => {
              expect(rendered.baseElement).toMatchSnapshot();
            });

            it("still shows the loader for repositories", () => {
              expect(
                rendered.queryByTestId("helm-repositories-are-loading"),
              ).toBeInTheDocument();
            });

            it("does not show message about no repositories", () => {
              expect(
                rendered.queryByTestId("no-helm-repositories"),
              ).not.toBeInTheDocument();
            });


            it("calls for repositories again", () => {
              expect(readYamlFileMock).toHaveBeenCalledWith(
                "some-helm-repository-config-file.yaml",
              );
            });

            describe("when another call for repositories resolve", () => {
              beforeEach(async () => {
                await readYamlFileMock.resolveSpecific(
                  ["some-helm-repository-config-file.yaml"],

                  {
                    repositories: [
                      {
                        name: "bitnami",
                        url: "https://charts.bitnami.com/bitnami",
                        caFile: "irrelevant",
                        certFile: "irrelevant",
                        insecure_skip_tls_verify: false,
                        keyFile: "irrelevant",
                        pass_credentials_all: false,
                        password: "irrelevant",
                        username: "irrelevant",
                      },
                    ],
                  },
                );
              });

              it("does not show loader for repositories anymore", () => {
                expect(
                  rendered.queryByTestId("helm-repositories-are-loading"),
                ).not.toBeInTheDocument();
              });

              it("shows the added repository", () => {
                const actual = rendered.getByTestId("helm-repository-bitnami");

                expect(actual).toBeInTheDocument();
              });

              it("does not show message about no repositories", () => {
                expect(
                  rendered.queryByTestId("no-helm-repositories"),
                ).not.toBeInTheDocument();
              });
            });
          });
        });
      });
    });
  });
});

const repositoryConfigStub: HelmRepositoriesFromYaml = {
  repositories: [
    {
      name: "some-repository",
      url: "some-repository-url",
      caFile: "irrelevant",
      certFile: "irrelevant",
      insecure_skip_tls_verify: false,
      keyFile: "irrelevant",
      pass_credentials_all: false,
      password: "irrelevant",
      username: "irrelevant",
    },

    {
      name: "some-other-repository",
      url: "some-other-repository-url",
      caFile: "irrelevant",
      certFile: "irrelevant",
      insecure_skip_tls_verify: false,
      keyFile: "irrelevant",
      pass_credentials_all: false,
      password: "irrelevant",
      username: "irrelevant",
    },
  ],
};
