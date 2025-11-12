// ...existing imports...
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
// ...existing imports...

const routes: Routes = [
	// Add this debug route at top-level BEFORE any wildcard or default redirects
	{
		path: 'debug/db-inspector',
		loadComponent: () => import('./debug/db-inspector.component').then(m => m.DbInspectorComponent)
	},

	// ...existing routes...
	// Ensure any { path: '', ... } or { path: '**', redirectTo: ... } entries remain AFTER the debug route
];

@NgModule({
	imports: [RouterModule.forRoot(routes /*, ...existing router config... */)],
	exports: [RouterModule]
})
export class AppRoutingModule { }
