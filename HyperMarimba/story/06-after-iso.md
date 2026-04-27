While for a given marimba there might be non-isometric marimbas which are isomelodic to it, they are rare.

_<b>Theorem 1.2.</b>
    For any orientable hyperbolic marimba $(X_0,\Gamma_0)$ there are finitely many hyperbolic marimbas $(X_1,\Gamma_1),\dots,(X_k,\Gamma_k)$ such that any other orientable hyperbolic marimba $(X',\Gamma')$ with $\chi(X')=\chi(X)$ which is isomelodic to $(X_0,\Gamma_0)$ is isometric to one of the $(X_i,\Gamma_i)$'s._

Indeed, generic marimbas are uniquely determined by their melodies.

_<b>Theorem 1.3.</b> 
    If the underlying hyperbolic surface of an orientable hyperbolic marimba $(X_0,\Gamma_0)$ is generic, then any other orientable marimba $(X',\Gamma')$ with $\chi(X')=\chi(X_0)$ which is isomelodic to $(X_0,\Gamma_0)$  is isometric to $(X_0,\Gamma_0)$._

Both theorems fail without the proviso that $\chi(X)=\chi(X')$.

These two theorems are clearly reminiscent of the analogue results&mdash;due to _Wolpert_&mdash;for _isospectral_ surfaces. Recall that two surfaces are _isospectral_ if they have the same spectrum of the Laplacian, or equivalently, if have the same _unmarked length spectrum_. Indeed, to prove the two results above, we follow the same basic strategy as in that case. For example, to prove Theorem 1.3 we show that the set of hyperbolic marimbas for which there is a non-isometric isomelodic marimba is contained in a countable union of proper analytic subsets of Teichmüller space. 

In our argument we rely on a <a href="https://arxiv.org/abs/2412.15034" style="color: #B0E0E6;">recent paper</a> by <a href="https://perso.math.u-pem.fr/lequellec.nolwenn/" style="color: #B0E0E6;">Nolwenn Le Quellec</a>. She adapted Wolpert's original argument to study the rigidity properties of the orthospectrum of a compact surface with boundary. In our setting, the length spectrum is replaced by what we call the _$k$-orthospectrum_. For $k=1$, this is nothing other than the usual orthospectrum of $X\setminus\Gamma$.

Showing that the _$k$-orthospectrum_ of the marimba $(X,\Gamma)$ is determined by the melody of random vectors is one of the key technical results in the paper (Proposition 7.1). We do that by showing that the _$k$-orthospectrum_ can be read from the cumulative distribution function of the set of gaps between notes in a random melody. In the next panel we show this numerically for the $1$-orthospectrum, that is for the orthospectrum of $X\setminus\Gamma$.