# Startup bytecode repair

Observed on 2026-10-11: Spring DevTools failed while resolving DocumentRecordQueryService constructors with NoClassDefFoundError: DocumentRecordMapper.

Source imports and mapper files were correct. javap showed the compiled constructor descriptor referring to LDocumentRecordMapper; without the package. The class contained an Unresolved compilation marker. Initial scan found five affected classes. Maven compilation succeeded, but an immediate scan showed ten unresolved classes and the query-service constructor was overwritten again. This is consistent with concurrent IDE compilation replacing Maven output with unresolved bytecode, rather than a missing mapper bean.

Temporarily set java.autobuild.enabled to false in .vscode/settings.json to stop concurrent output replacement during repair. Subsequently restored it to true at the user's request: automatic compilation and DevTools reload are the intended workflow. Disabling auto-build is not the permanent solution. The setting is documented by [VS Code Java](https://github.com/redhat-developer/vscode-java). The IDE's unresolved project/classpath state still requires investigation and refresh.

Backed up generated class files under target/audit-startup/classes-before-rebuild and removed only .class files within the verified target/classes path. Source, resources and database were untouched. Rebuilt using:

```powershell
.\mvnw.cmd compile '-DskipTests' '-Dspotless.skip=true' '-Dcheckstyle.skip=true'
```

Validation: Maven exit 0; 154 resulting class files contained no Unresolved compilation markers. javap confirmed the fully qualified DocumentRecordMapper constructor descriptor. Reflection using the Maven runtime classpath successfully resolved constructors of DocumentRecordQueryService, HouseholdQueryService, ResidentQueryService, SecurityAlertQueryService and DocumentRecordResource. No application context, live database migration or complete application startup was executed; other runtime configuration failures are not ruled out.

Stop the previous application process before restarting through Maven:

```powershell
.\mvnw.cmd spring-boot:run '-Dspotless.skip=true'
```

If IDE output contains unresolved compilation markers again, refresh the Java language-server workspace and Maven project configuration before restarting. Do not continue launching unresolved IDE builds. Existing Maven dependency convergence and mapper warnings are separate from this class-loading failure.
